// @ts-check
/// <reference path="../worker-configuration.d.ts" />

import { getAddress, isAddress } from "viem";

const BASE_SEPOLIA_CHAIN_ID = "84532";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FLOW_AMOUNT_USD = "1.00";
const FLOW_EXPIRES_IN_SECONDS = 900;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const PAYMENT_INTENT_ID = /^ONE-BS-[A-Z0-9-]{8,64}$/;
const FLOW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Compare fixed-length digests so an access-key mismatch does not short-circuit.
 * @param {string} left
 * @param {string} right
 */
async function safeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) mismatch |= leftBytes[index] ^ rightBytes[index];
  return mismatch === 0;
}

/**
 * @param {string | null} origin
 * @param {Env} env
 */
function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  return env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).includes(origin);
}

/**
 * @param {string | null} origin
 */
function responseHeaders(origin) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-One-Demo-Key");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {string | null} origin
 */
function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

/**
 * @param {Env} env
 */
function missingConfiguration(env) {
  return !env.DYNAMIC_API_TOKEN
    || !env.ONE_DEMO_ACCESS_KEY;
}

/**
 * @param {unknown} value
 */
function normalizeSettlementDestination(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim();
  if (!EVM_ADDRESS.test(candidate) || !isAddress(candidate)) return "";
  const normalized = getAddress(candidate);
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower === ZERO_ADDRESS || normalizedLower === BASE_SEPOLIA_USDC.toLowerCase()) return "";
  return normalized;
}

/**
 * Keep provider diagnostics useful without logging arbitrary response bodies.
 * @param {unknown} value
 * @param {number} [maximumLength]
 */
function compactDiagnostic(value, maximumLength = 200) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

/**
 * Extract only Dynamic's documented error code/message fields.
 * @param {Response} response
 */
async function readDynamicDiagnostic(response) {
  try {
    /** @type {unknown} */
    const payload = await response.clone().json();
    if (!isRecord(payload)) return { code: "", message: "" };
    if (typeof payload.error === "string") {
      return { code: compactDiagnostic(payload.code, 80), message: compactDiagnostic(payload.error) };
    }
    if (isRecord(payload.error)) {
      return {
        code: compactDiagnostic(payload.error.code, 80),
        message: compactDiagnostic(payload.error.message),
      };
    }
    return { code: compactDiagnostic(payload.code, 80), message: compactDiagnostic(payload.message) };
  } catch {
    return { code: "", message: "" };
  }
}

/**
 * Convert provider status/details into a safe presenter-facing explanation.
 * @param {number} status
 * @param {{ code: string, message: string }} diagnostic
 */
function describeDynamicFailure(status, diagnostic) {
  const message = diagnostic.message.toLowerCase();
  if (status === 400 && message.includes("flow is not enabled")) {
    return "Dynamic Flow is not enabled for this environment.";
  }
  if (status === 401) return "Dynamic did not accept the configured API token.";
  if (status === 403) return "Dynamic denied this environment or API-token scope.";
  if (status === 422) return "Dynamic rejected the configured Base Sepolia test route.";
  return "Dynamic Flow creation did not complete.";
}

/**
 * Verify the complete server-visible configuration before the browser is
 * allowed to treat a Flow ID as bound to its local payment attempt.
 * @param {Record<string, unknown>} flow
 * @param {{ flowId: string, paymentIntentId: string, settlementDestination: string }} expected
 */
function flowConfigurationMatches(flow, expected) {
  if (flow.id !== expected.flowId
    || flow.mode !== "payment"
    || flow.amount !== FLOW_AMOUNT_USD
    || flow.currency !== "USD"
    || flow.disableSwaps !== true
    || flow.pegStablecoins !== true
    || !isRecord(flow.memo)
    || flow.memo.orderId !== expected.paymentIntentId
    || !isRecord(flow.settlementConfig)
    || flow.settlementConfig.strategy !== "cheapest"
    || !Array.isArray(flow.settlementConfig.settlements)
    || flow.settlementConfig.settlements.length !== 1
    || !isRecord(flow.destinationConfig)
    || !Array.isArray(flow.destinationConfig.destinations)
    || flow.destinationConfig.destinations.length !== 1) {
    return false;
  }

  const settlement = flow.settlementConfig.settlements[0];
  const destination = flow.destinationConfig.destinations[0];
  if (!isRecord(settlement)
    || settlement.chainName !== "EVM"
    || settlement.chainId !== BASE_SEPOLIA_CHAIN_ID
    || settlement.symbol !== "USDC"
    || settlement.tokenDecimals !== 6
    || typeof settlement.tokenAddress !== "string"
    || settlement.tokenAddress.toLowerCase() !== BASE_SEPOLIA_USDC.toLowerCase()
    || !isRecord(destination)
    || destination.chainName !== "EVM"
    || destination.type !== "address") {
    return false;
  }

  return normalizeSettlementDestination(destination.identifier) === expected.settlementDestination;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {typeof fetch} upstreamFetch
 */
async function handleRequest(request, env, upstreamFetch = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, env)) return json({ error: "Origin not allowed." }, 403, null);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });

  if (url.pathname === "/health" && request.method === "GET") {
    return json({
      service: "one-gateway-flow-demo",
      ready: !missingConfiguration(env),
      environmentId: env.DYNAMIC_ENVIRONMENT_ID,
      route: {
        amount: FLOW_AMOUNT_USD,
        asset: "USDC",
        chainId: BASE_SEPOLIA_CHAIN_ID,
      },
    }, 200, origin);
  }

  const isCreateRequest = url.pathname === "/v1/flows";
  const isVerifyRequest = url.pathname === "/v1/flows/verify";
  if (!isCreateRequest && !isVerifyRequest) return json({ error: "Not found." }, 404, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (missingConfiguration(env)) return json({ error: "Flow demo backend is not configured." }, 503, origin);
  if (isVerifyRequest && !origin) return json({ error: "Origin is required." }, 403, null);

  const suppliedAccessKey = request.headers.get("X-One-Demo-Key") ?? "";
  if (!suppliedAccessKey || !(await safeEqual(suppliedAccessKey, env.ONE_DEMO_ACCESS_KEY))) {
    return json({ error: "Demo access key was not accepted." }, 401, origin);
  }

  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415, origin);
  }
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 4096) return json({ error: "Request body is too large." }, 413, origin);

  /** @type {unknown} */
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, origin);
  }
  if (!isRecord(body)) return json({ error: "Request body must be an object." }, 400, origin);
  const allowedKeys = new Set(isVerifyRequest
    ? ["flowId", "paymentIntentId", "settlementDestination"]
    : ["paymentIntentId", "settlementDestination"]);
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length) {
    return json({
      error: isVerifyRequest
        ? "Only flowId, paymentIntentId and settlementDestination are accepted."
        : "Only paymentIntentId and settlementDestination are accepted.",
    }, 400, origin);
  }

  const paymentIntentId = typeof body.paymentIntentId === "string" ? body.paymentIntentId : "";
  if (!PAYMENT_INTENT_ID.test(paymentIntentId)) return json({ error: "Payment intent ID is not valid." }, 400, origin);
  const settlementDestination = normalizeSettlementDestination(body.settlementDestination);
  if (!settlementDestination) {
    return json({ error: "Settlement destination must be a valid, non-zero EVM address and cannot be the USDC contract." }, 400, origin);
  }

  if (isVerifyRequest) {
    const flowId = typeof body.flowId === "string" ? body.flowId : "";
    if (!FLOW_ID.test(flowId)) return json({ error: "Flow ID must be a valid UUID." }, 400, origin);

    const requestId = crypto.randomUUID();
    /** @type {Response} */
    let upstream;
    try {
      upstream = await upstreamFetch(
        `https://app.dynamicauth.com/api/v0/server/${env.DYNAMIC_ENVIRONMENT_ID}/flow/${flowId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.DYNAMIC_API_TOKEN}`,
            "X-Request-ID": requestId,
          },
        },
      );
    } catch {
      console.error(JSON.stringify({ event: "dynamic_flow_verify_unreachable", requestId }));
      return json({ error: "Dynamic Flow verification did not complete.", requestId }, 502, origin);
    }

    if (!upstream.ok) {
      const diagnostic = await readDynamicDiagnostic(upstream);
      console.error(JSON.stringify({
        event: "dynamic_flow_verify_failed",
        requestId,
        status: upstream.status,
        ...(diagnostic.code ? { dynamicCode: diagnostic.code } : {}),
        ...(diagnostic.message ? { dynamicMessage: diagnostic.message } : {}),
      }));
      return json({
        error: "Dynamic Flow verification did not complete.",
        upstreamStatus: upstream.status,
        requestId,
      }, 502, origin);
    }

    /** @type {unknown} */
    let upstreamBody;
    try {
      upstreamBody = await upstream.json();
    } catch {
      console.error(JSON.stringify({ event: "dynamic_flow_verify_invalid_response", requestId }));
      return json({ error: "Dynamic returned an invalid Flow verification response.", requestId }, 502, origin);
    }
    const flow = isRecord(upstreamBody) && isRecord(upstreamBody.flow)
      ? upstreamBody.flow
      : upstreamBody;
    if (!isRecord(flow)) {
      console.error(JSON.stringify({ event: "dynamic_flow_verify_invalid_response", requestId }));
      return json({ error: "Dynamic returned an invalid Flow verification response.", requestId }, 502, origin);
    }
    if (!flowConfigurationMatches(flow, { flowId, paymentIntentId, settlementDestination })) {
      console.error(JSON.stringify({ event: "dynamic_flow_verify_mismatch", requestId, paymentIntentId, flowId }));
      return json({ error: "Dynamic Flow configuration does not match this payment attempt.", requestId }, 409, origin);
    }

    console.log(JSON.stringify({ event: "dynamic_flow_verified", requestId, paymentIntentId, flowId }));
    return json({ verified: true }, 200, origin);
  }

  const requestId = crypto.randomUUID();
  const dynamicBody = {
    amount: FLOW_AMOUNT_USD,
    currency: "USD",
    expiresIn: FLOW_EXPIRES_IN_SECONDS,
    pegStablecoins: true,
    disableSwaps: true,
    settlementConfig: {
      strategy: "cheapest",
      settlements: [{
        chainName: "EVM",
        chainId: BASE_SEPOLIA_CHAIN_ID,
        tokenAddress: BASE_SEPOLIA_USDC,
        symbol: "USDC",
        tokenDecimals: 6,
      }],
    },
    destinationConfig: {
      destinations: [{
        chainName: "EVM",
        type: "address",
        identifier: settlementDestination,
      }],
    },
    memo: {
      description: "ONE Gateway V3 Base Sepolia evidence demo",
      orderId: paymentIntentId,
    },
  };

  const upstream = await upstreamFetch(
    `https://app.dynamicauth.com/api/v0/server/${env.DYNAMIC_ENVIRONMENT_ID}/flow/payment`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.DYNAMIC_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      body: JSON.stringify(dynamicBody),
    },
  );

  if (!upstream.ok) {
    const diagnostic = await readDynamicDiagnostic(upstream);
    console.error(JSON.stringify({
      event: "dynamic_flow_create_failed",
      requestId,
      status: upstream.status,
      ...(diagnostic.code ? { dynamicCode: diagnostic.code } : {}),
      ...(diagnostic.message ? { dynamicMessage: diagnostic.message } : {}),
    }));
    return json({
      error: describeDynamicFailure(upstream.status, diagnostic),
      upstreamStatus: upstream.status,
      requestId,
    }, 502, origin);
  }

  /** @type {unknown} */
  const upstreamBody = await upstream.json();
  const flowId = isRecord(upstreamBody)
    && isRecord(upstreamBody.flow)
    && typeof upstreamBody.flow.id === "string"
    ? upstreamBody.flow.id
    : "";
  if (!flowId) {
    console.error(JSON.stringify({ event: "dynamic_flow_create_invalid_response", requestId }));
    return json({ error: "Dynamic returned an invalid Flow response.", requestId }, 502, origin);
  }

  console.log(JSON.stringify({ event: "dynamic_flow_created", requestId, paymentIntentId, flowId }));
  return json({ flowId }, 201, origin);
}

/** @type {ExportedHandler<Env>} */
export default {
  async fetch(request, env, context) {
    void context;
    return handleRequest(request, env);
  },
};
