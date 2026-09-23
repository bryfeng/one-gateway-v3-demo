import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

// Local, in-memory rehearsal only. This module never calls a provider or moves funds.
const account = {
  id: "00000000-0000-4000-8000-000000000001", type: "fiat", iban: "DEMO-EUR-ACCOUNT",
  description: "Northstar EUR operating account (fictional)",
  currency: { name: "Euro", alpha3Code: "EUR", numericCode: "978" },
  balance: 12500, availableBalance: 12500, pendingFunds: 0,
  bankId: "00000000-0000-4000-8000-000000000002", isPrimary: true, status: "active",
  accountNumber: null, sortCode: null, cryptoAddresses: null,
};
const terminal = new Set(["settled", "blocked", "expired", "failed"]);

export function createDemoServer() {
  const payments = new Map();
  const idempotency = new Map();
  const events = [];
  const receipts = new Map();

  function consume(event) {
    const previous = receipts.get(event.id);
    const receipt = { eventId: event.id, paymentIntentId: event.paymentIntentId,
      outcome: previous ? "duplicate_ignored" : "processed", deliveries: (previous?.deliveries ?? 0) + 1 };
    receipts.set(event.id, receipt);
    return receipt;
  }

  function emit(payment, type) {
    const event = { id: `evt_demo_${randomUUID()}`, type, paymentIntentId: payment.id,
      createdAt: new Date().toISOString(), mode: "mock", data: structuredClone(payment) };
    events.push(event);
    consume(event);
  }

  function transition(payment, action) {
    if (terminal.has(payment.status)) return "This payment is terminal. Create a new request to test another outcome.";
    if (["source_confirmed", "blocked", "expired"].includes(action)) {
      if (payment.status !== "awaiting_payment") return "This action requires an unpaid request.";
    } else if (["settled", "failed"].includes(action)) {
      if (payment.status !== "processing") return "Confirm the source payment before simulating settlement.";
    } else return "Unknown demo action.";

    if (action === "source_confirmed") {
      payment.status = "processing";
      payment.provider = { ...payment.provider, riskState: "cleared", executionState: "source_confirmed", settlementState: "settling" };
      payment.sourceReference = `DEMO-SOURCE-${payment.id.slice(-8)}`;
    } else if (action === "settled") {
      payment.status = "settled";
      payment.provider.settlementState = "completed";
      payment.settlementReference = `DEMO-SETTLEMENT-${payment.id.slice(-8)}`;
    } else if (action === "blocked") {
      payment.status = "blocked";
      payment.provider.riskState = "blocked";
    } else if (action === "expired") {
      payment.status = "expired";
      payment.provider.executionState = "expired";
    } else {
      payment.status = "failed";
      payment.provider.settlementState = "failed";
    }
    payment.updatedAt = new Date().toISOString();
    emit(payment, `payment.${payment.status}`);
    return null;
  }

  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-One-Demo-Mode": "mock" });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      const method = req.method;
      if (method === "GET" && path === "/health") return send(200, { service: "one-local-merchant-demo", mode: "mock", persistent: false });
      if (method === "GET" && path === "/api/v1/accounts") {
        const unsupported = [...url.searchParams.keys()].filter((key) => !["accountType", "iban", "accountNumber", "sortCode"].includes(key));
        if (unsupported.length) return send(400, { error: "Unsupported mock account filter." });
        const type = url.searchParams.get("accountType")?.toLowerCase();
        if (type && !["fiat", "crypto"].includes(type)) return send(400, { error: "accountType must be fiat or crypto." });
        const matches = type !== "crypto" && ["iban", "accountNumber", "sortCode"].every((key) => !url.searchParams.has(key) || url.searchParams.get(key) === account[key]);
        return send(200, matches ? [account] : []);
      }
      if (method === "GET" && path.startsWith("/api/v1/accounts/")) return path === `/api/v1/accounts/${account.id}` ? send(200, account) : send(404, { error: "Account not found." });
      if (method === "GET" && path === "/gateway/v3/payment-intents") return send(200, { mode: "mock", items: [...payments.values()].reverse() });
      if (method === "GET" && path === "/demo/events") return send(200, { items: events.map((event) => ({ ...event, receipt: receipts.get(event.id) })).reverse() });
      const paymentMatch = path.match(/^\/gateway\/v3\/payment-intents\/([^/]+)$/);
      if (method === "GET" && paymentMatch) return payments.has(paymentMatch[1]) ? send(200, payments.get(paymentMatch[1])) : send(404, { error: "Payment request not found. Local requests reset when the demo server restarts." });

      if (method !== "POST") return send(404, { error: "This operation is not implemented by the local mock." });
      if (req.headers["x-one-demo-mode"] !== "mock") return send(403, { error: "Explicit mock mode is required." });
      if (!req.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "JSON is required." });
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 8192) return send(413, { error: "Request too large." });
      }
      let body;
      try { body = JSON.parse(raw); } catch { return send(400, { error: "Invalid JSON." }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return send(400, { error: "A JSON object is required." });

      if (path === "/gateway/v3/payment-intents") {
        const key = req.headers["idempotency-key"];
        if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) return send(400, { error: "An Idempotency-Key of 8–100 letters, digits, hyphens or underscores is required." });
        if (Object.keys(body).some((key) => !["merchantReference", "amount", "currency"].includes(key))) return send(400, { error: "Only merchantReference, amount and currency are supported." });
        if (typeof body.merchantReference !== "string" || !/^[A-Za-z0-9 _-]{1,64}$/.test(body.merchantReference.trim())) return send(400, { error: "Use a merchant reference of 1–64 letters, digits, spaces, hyphens or underscores." });
        if (body.amount !== "1.00" || body.currency !== "USD") return send(400, { error: "This rehearsal fixes the order at 1.00 USD, settling 1.00 test USDC on Base Sepolia." });
        const request = { merchantReference: body.merchantReference.trim(), amount: body.amount, currency: body.currency };
        const signature = JSON.stringify(request);
        const previous = idempotency.get(key);
        if (previous) return previous.signature === signature ? send(200, payments.get(previous.id)) : send(409, { error: "That idempotency key was used for a different request." });
        if (payments.size >= 100) return send(429, { error: "Local demo capacity reached. Restart the mock server to reset." });
        const id = `ONE-BS-${randomUUID().toUpperCase()}`;
        const payment = { id, ...request, mode: "mock", status: "awaiting_payment", createdAt: new Date().toISOString(),
          checkoutPath: `?checkout=${id}`, settlement: { amount: "1.00", asset: "USDC", chainId: "84532", destination: "DEMO-MERCHANT-SELF-CUSTODY" },
          provider: { name: "Fireblocks Flow", flowId: `DEMO-FLOW-${randomUUID()}`, riskState: "none", executionState: "initiated", settlementState: "none" },
          sourceReference: null, settlementReference: null };
        payments.set(id, payment);
        idempotency.set(key, { signature, id });
        emit(payment, "payment.created");
        return send(201, payment);
      }
      const actionMatch = path.match(/^\/demo\/payment-intents\/([^/]+)\/actions$/);
      if (actionMatch) {
        const payment = payments.get(actionMatch[1]);
        if (!payment) return send(404, { error: "Payment not found." });
        const error = transition(payment, body.action);
        return error ? send(409, { error }) : send(200, payment);
      }
      const replayMatch = path.match(/^\/demo\/events\/([^/]+)\/replay$/);
      if (replayMatch) {
        const event = events.find((item) => item.id === replayMatch[1]);
        return event ? send(200, consume(event)) : send(404, { error: "Event not found." });
      }
      return send(404, { error: "This operation is not implemented by the local mock." });
    } catch {
      if (!res.headersSent) send(500, { error: "The local mock could not process this request." });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createDemoServer().listen(8790, "127.0.0.1", () => process.stdout.write("ONE local mock API ready at http://127.0.0.1:8790 (in-memory; no provider calls)\n"));
}
