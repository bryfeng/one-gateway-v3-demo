// @ts-check
/// <reference path="../worker-configuration.d.ts" />

const BASE_SEPOLIA_CHAIN_ID = "84532";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FLOW_AMOUNT_USD = "1.00";
const FLOW_EXPIRES_IN_SECONDS = 900;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const PAYMENT_INTENT_ID = /^ONE-BS-[A-Z0-9-]{8,64}$/;

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
    || !env.ONE_DEMO_ACCESS_KEY
    || !EVM_ADDRESS.test(env.MERCHANT_BASE_SEPOLIA_ADDRESS)
    || env.MERCHANT_BASE_SEPOLIA_ADDRESS.toLowerCase() === ZERO_ADDRESS;
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

  if (url.pathname !== "/v1/flows") return json({ error: "Not found." }, 404, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (missingConfiguration(env)) return json({ error: "Flow demo backend is not configured." }, 503, origin);

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
  const unknownKeys = Object.keys(body).filter((key) => key !== "paymentIntentId");
  if (unknownKeys.length) return json({ error: "Only paymentIntentId is accepted." }, 400, origin);

  const paymentIntentId = typeof body.paymentIntentId === "string" ? body.paymentIntentId : "";
  if (!PAYMENT_INTENT_ID.test(paymentIntentId)) return json({ error: "Payment intent ID is not valid." }, 400, origin);

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
        identifier: env.MERCHANT_BASE_SEPOLIA_ADDRESS,
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
    console.error(JSON.stringify({ event: "dynamic_flow_create_failed", requestId, status: upstream.status }));
    return json({ error: "Dynamic Flow creation did not complete.", upstreamStatus: upstream.status, requestId }, 502, origin);
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
