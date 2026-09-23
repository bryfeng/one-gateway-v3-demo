import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createDemoServer } from "../demo-api/server.mjs";

async function fixture(t) {
  const server = createDemoServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, body, key = "test-request-key") => {
    const response = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-One-Demo-Mode": "mock", "Idempotency-Key": key },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
}
const create = (api, reference = "TEST-ORDER", key) => api("/gateway/v3/payment-intents", { merchantReference: reference, amount: "1.00", currency: "USD" }, key);
const action = (api, id, action) => api(`/demo/payment-intents/${id}/actions`, { action });

test("create is idempotent, detects changed payloads, and validates the fixed route", async (t) => {
  const api = await fixture(t);
  const first = await create(api);
  const repeat = await create(api);
  assert.equal(first.status, 201);
  assert.equal(repeat.status, 200);
  assert.equal(first.body.id, repeat.body.id);
  assert.equal((await create(api, "OTHER-ORDER")).status, 409);
  assert.equal((await api("/gateway/v3/payment-intents")).body.items.length, 1);
  assert.equal((await api("/demo/events")).body.items.length, 1);
  assert.equal((await api("/gateway/v3/payment-intents", { merchantReference: "WRONG", amount: "10.00", currency: "USD" }, "wrong-amount-key")).status, 400);
  assert.equal((await api("/gateway/v3/payment-intents", { merchantReference: " ", amount: "1.00", currency: "USD" }, "empty-reference")).status, 400);
});

test("source confirmation does not settle or credit ONE; settlement and event replay stay distinct", async (t) => {
  const api = await fixture(t);
  const { body: payment } = await create(api);
  const accounts = (await api("/api/v1/accounts")).body;
  assert.equal((await action(api, payment.id, "settled")).status, 409);
  const source = await action(api, payment.id, "source_confirmed");
  assert.equal(source.body.status, "processing");
  assert.equal(source.body.provider.executionState, "source_confirmed");
  assert.equal(source.body.provider.settlementState, "settling");
  assert.equal(source.body.settlementReference, null);
  assert.equal((await action(api, payment.id, "source_confirmed")).status, 409);
  assert.equal((await action(api, payment.id, "expired")).status, 409);
  const settled = await action(api, payment.id, "settled");
  assert.equal(settled.body.status, "settled");
  assert.equal(settled.body.provider.settlementState, "completed");
  assert.match(settled.body.settlementReference, /^DEMO-/);
  assert.deepEqual((await api("/api/v1/accounts")).body, accounts);
  const events = (await api("/demo/events")).body.items;
  assert.deepEqual(events.map((e) => e.type), ["payment.settled", "payment.processing", "payment.created"]);
  const replay = await api(`/demo/events/${events[2].id}/replay`, {});
  assert.equal(replay.body.outcome, "duplicate_ignored");
  assert.equal(replay.body.deliveries, 2);
  assert.equal((await api(`/gateway/v3/payment-intents/${payment.id}`)).body.status, "settled");
  assert.equal((await action(api, payment.id, "failed")).status, 409);
});

test("blocked and expired requests cannot pay, while settlement failure retains the source evidence", async (t) => {
  const api = await fixture(t);
  for (const outcome of ["blocked", "expired"]) {
    const { body: payment } = await create(api, outcome, `request-${outcome}`);
    assert.equal((await action(api, payment.id, outcome)).body.status, outcome);
    assert.equal((await action(api, payment.id, "source_confirmed")).status, 409);
    assert.equal((await action(api, payment.id, "settled")).status, 409);
    assert.equal((await api(`/gateway/v3/payment-intents/${payment.id}`)).body.sourceReference, null);
  }
  const { body: payment } = await create(api, "FAILURE", "request-failure");
  await action(api, payment.id, "source_confirmed");
  const failed = await action(api, payment.id, "failed");
  assert.equal(failed.body.status, "failed");
  assert.equal(failed.body.provider.settlementState, "failed");
  assert.match(failed.body.sourceReference, /^DEMO-/);
  assert.equal(failed.body.settlementReference, null);
});

test("ONE account mock uses the published response shape and filters; unknown operations fail", async (t) => {
  const api = await fixture(t);
  const { body: accounts } = await api("/api/v1/accounts?accountType=fiat");
  assert.equal(accounts[0].currency.alpha3Code, "EUR");
  assert.equal(accounts[0].availableBalance, 12500);
  assert.equal(accounts[0].cryptoAddresses, null);
  assert.deepEqual((await api(`/api/v1/accounts/${accounts[0].id}`)).body, accounts[0]);
  assert.deepEqual((await api("/api/v1/accounts?accountType=Crypto")).body, []);
  assert.deepEqual((await api("/api/v1/accounts?iban=NOT-THIS-ACCOUNT")).body, []);
  assert.equal((await api("/api/v1/accounts?accountType=unknown")).status, 400);
  assert.equal((await api("/api/v1/accounts/unknown")).status, 404);
  assert.equal((await api("/api/v1/payments/sepa", {})).status, 404);
  assert.equal((await api("/gateway/v3/payment-intents/missing")).status, 404);
});

test("raw HTTP rejects malformed JSON and writes without explicit mock mode", async (t) => {
  const server = createDemoServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/gateway/v3/payment-intents`;
  assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 403);
  assert.equal((await fetch(url, { method: "POST", headers: { "X-One-Demo-Mode": "mock", "Content-Type": "application/json" }, body: "broken" })).status, 400);
});
