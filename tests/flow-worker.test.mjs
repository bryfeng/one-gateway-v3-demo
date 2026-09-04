import assert from "node:assert/strict";
import test from "node:test";
import worker from "../flow-worker/src/index.js";

const merchantAddress = "0x2222222222222222222222222222222222222222";
const allowedOrigin = "https://bryfeng.github.io";
const env = {
  DYNAMIC_ENVIRONMENT_ID: "3608a494-ff5c-4cbc-a425-ddc382e4a90a",
  DYNAMIC_API_TOKEN: "test-token-not-a-real-dynamic-credential",
  ONE_DEMO_ACCESS_KEY: "meeting-only-key",
  ALLOWED_ORIGINS: `${allowedOrigin},http://localhost:5173`,
};

function request(path, init = {}) {
  return new Request(`https://one-flow.example${path}`, {
    ...init,
    headers: {
      Origin: allowedOrigin,
      ...(init.headers ?? {}),
    },
  });
}

function createRequest(body, overrides = {}) {
  return request("/v1/flows", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-One-Demo-Key": env.ONE_DEMO_ACCESS_KEY,
      ...(overrides.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...overrides,
  });
}

test("health reports only readiness and the fixed public test route", async () => {
  const response = await worker.fetch(request("/health"), env, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "one-gateway-flow-demo",
    ready: true,
    environmentId: env.DYNAMIC_ENVIRONMENT_ID,
    route: { amount: "1.00", asset: "USDC", chainId: "84532" },
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
});

test("missing private credentials never report ready or create a Flow", async () => {
  const incompleteEnv = { ...env, DYNAMIC_API_TOKEN: "" };
  const healthResponse = await worker.fetch(request("/health"), incompleteEnv, {});
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).ready, false);

  const createResponse = await worker.fetch(createRequest({
    paymentIntentId: "ONE-BS-ABCD1234",
    settlementDestination: merchantAddress,
  }), incompleteEnv, {});
  assert.equal(createResponse.status, 503);
  assert.match((await createResponse.json()).error, /not configured/);
});

test("create accepts a payment-intent linkage and validated settlement destination", async () => {
  let capturedUrl = "";
  let capturedInit;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return Response.json({ flow: { id: "flow_test_123" } });
  };

  try {
    const response = await worker.fetch(createRequest({
      paymentIntentId: "ONE-BS-ABCD1234",
      settlementDestination: merchantAddress,
    }), env, {});
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { flowId: "flow_test_123" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedUrl, `https://app.dynamicauth.com/api/v0/server/${env.DYNAMIC_ENVIRONMENT_ID}/flow/payment`);
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers.Authorization, `Bearer ${env.DYNAMIC_API_TOKEN}`);
  const dynamicBody = JSON.parse(capturedInit.body);
  assert.equal(dynamicBody.amount, "1.00");
  assert.equal(dynamicBody.currency, "USD");
  assert.equal(dynamicBody.expiresIn, 900);
  assert.equal(dynamicBody.disableSwaps, true);
  assert.equal(dynamicBody.pegStablecoins, true);
  assert.equal(dynamicBody.settlementConfig.settlements[0].chainId, "84532");
  assert.equal(dynamicBody.settlementConfig.settlements[0].tokenAddress, "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  assert.equal(dynamicBody.settlementConfig.settlements[0].tokenDecimals, 6);
  assert.equal(dynamicBody.destinationConfig.destinations[0].identifier, merchantAddress);
  assert.deepEqual(dynamicBody.memo, {
    description: "ONE Gateway V3 Base Sepolia evidence demo",
    orderId: "ONE-BS-ABCD1234",
  });
  assert.equal("payerAddress" in dynamicBody.memo, false);
});

test("the public caller cannot choose chain, token or amount", async () => {
  const response = await worker.fetch(createRequest({
    paymentIntentId: "ONE-BS-ABCD1234",
    settlementDestination: merchantAddress,
    amount: "1000.00",
  }), env, {});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Only paymentIntentId and settlementDestination/);
});

test("settlement destination rejects missing, malformed, zero and token-contract addresses", async () => {
  for (const settlementDestination of [
    undefined,
    "not-an-address",
    "0x0000000000000000000000000000000000000000",
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  ]) {
    const body = { paymentIntentId: "ONE-BS-ABCD1234" };
    if (settlementDestination !== undefined) body.settlementDestination = settlementDestination;
    const response = await worker.fetch(createRequest(body), env, {});
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Settlement destination/);
  }
});

test("the create endpoint requires both the allowed origin and meeting key", async () => {
  const wrongOrigin = new Request("https://one-flow.example/v1/flows", {
    method: "POST",
    headers: {
      Origin: "https://attacker.example",
      "Content-Type": "application/json",
      "X-One-Demo-Key": env.ONE_DEMO_ACCESS_KEY,
    },
    body: JSON.stringify({ paymentIntentId: "ONE-BS-ABCD1234", settlementDestination: merchantAddress }),
  });
  const originResponse = await worker.fetch(wrongOrigin, env, {});
  assert.equal(originResponse.status, 403);

  const keyResponse = await worker.fetch(createRequest(
    { paymentIntentId: "ONE-BS-ABCD1234", settlementDestination: merchantAddress },
    { headers: { "X-One-Demo-Key": "wrong-key" } },
  ), env, {});
  assert.equal(keyResponse.status, 401);
});

test("upstream failures are redacted from the browser response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("provider detail that must not leak", { status: 422 });
  let response;
  try {
    response = await worker.fetch(createRequest({
      paymentIntentId: "ONE-BS-ABCD1234",
      settlementDestination: merchantAddress,
    }), env, {});
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(response.status, 502);
  const body = JSON.stringify(await response.json());
  assert.doesNotMatch(body, /provider detail/);
  assert.match(body, /Dynamic rejected the configured Base Sepolia test route/);
});

test("a disabled Dynamic Flow feature returns a useful safe explanation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "Flow is not enabled" }, { status: 400 });
  let response;
  try {
    response = await worker.fetch(createRequest({
      paymentIntentId: "ONE-BS-ABCD1234",
      settlementDestination: merchantAddress,
    }), env, {});
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error, "Dynamic Flow is not enabled for this environment.");
  assert.equal(body.upstreamStatus, 400);
  assert.equal(typeof body.requestId, "string");
});
