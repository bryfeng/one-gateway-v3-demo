import { useEffect, useState } from "react";

interface Payment {
  id: string; merchantReference: string; amount: string; currency: string;
  status: string; checkoutPath: string; createdAt: string;
  settlement: { amount: string; asset: string; chainId: string; destination: string };
  provider: { flowId: string; executionState: string; riskState: string; settlementState: string };
  sourceReference: string | null; settlementReference: string | null;
}
interface DemoEvent {
  id: string; type: string; paymentIntentId: string; createdAt: string;
  receipt: { outcome: string; deliveries: number };
}
interface Account { id: string; description: string; availableBalance: number; currency: { alpha3Code: string } }
interface ApiCall { method: string; path: string; status: number; body: unknown; response: unknown }

const labels: Record<string, string> = {
  awaiting_payment: "Awaiting payment", processing: "Settlement pending", settled: "Settled",
  blocked: "Blocked by screening", expired: "Expired", failed: "Settlement failed",
};
const readable = (error: unknown) => error instanceof Error ? error.message : "The local demo request failed.";
const showJson = (value: unknown) => JSON.stringify(value, null, 2);

async function api<T>(path: string, body?: unknown, key?: string): Promise<T> {
  const method = body === undefined ? "GET" : "POST";
  let response: Response;
  try {
    response = await fetch(`/demo-api${path}`, { method, headers: {
      Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json", "X-One-Demo-Mode": "mock" }),
      ...(key ? { "Idempotency-Key": key } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  } catch { throw new Error("Local mock API unavailable. Start the demo API, then retry. No provider request was made."); }
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error("Local mock API unavailable. This walkthrough needs the local demo server."); }
  // Keep mutations reviewable without filling the activity panel with background polls.
  if (method === "POST" || path === "/api/v1/accounts") window.dispatchEvent(new CustomEvent("one-demo-api", { detail: { method, path, status: response.status, body, response: value } }));
  if (!response.ok) throw new Error((value as { error?: string }).error || `Demo API returned ${response.status}.`);
  return value as T;
}

function PaymentStatus({ status }: { status: string }) {
  const tone = status === "settled" ? "green" : status === "awaiting_payment" ? "blue" : status === "processing" ? "amber" : "red";
  return <span className={`status status-${tone}`}>{labels[status] ?? status}</span>;
}

function PaymentEvidence({ payment }: { payment: Payment }) {
  return <div className="cycle-evidence">
    <div><span>Source transaction</span><strong>{payment.sourceReference ? "Confirmed · simulated" : "Not submitted"}</strong></div>
    <div><span>Merchant receipt</span><strong>{payment.status === "settled" ? "1.00 USDC · simulated" : "Not received"}</strong></div>
    <div><span>ONE account credit</span><strong>No credit or conversion</strong></div>
    <div><span>Settlement destination</span><strong>Merchant self-custody wallet</strong></div>
  </div>;
}

export function MerchantCycle() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reference, setReference] = useState("NORTHSTAR-1001");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [retryKey, setRetryKey] = useState(() => crypto.randomUUID());
  const selected = payments.find((payment) => payment.id === selectedId) ?? payments[0];

  async function refresh() {
    try {
      const [nextPayments, nextEvents, nextAccounts] = await Promise.all([
        api<{ items: Payment[] }>("/gateway/v3/payment-intents"), api<{ items: DemoEvent[] }>("/demo/events"), api<Account[]>("/api/v1/accounts?accountType=fiat"),
      ]);
      setPayments(nextPayments.items); setEvents(nextEvents.items); setAccounts(nextAccounts); setReady(true); setLoadError("");
    } catch (err) { setLoadError(readable(err)); setReady(false); }
  }
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    const log = (event: Event) => setCalls((current) => [(event as CustomEvent<ApiCall>).detail, ...current].slice(0, 8));
    window.addEventListener("one-demo-api", log);
    return () => { window.clearInterval(timer); window.removeEventListener("one-demo-api", log); };
  }, []);

  async function createRequest() {
    setBusy(true); setError("");
    try {
      const payment = await api<Payment>("/gateway/v3/payment-intents", { merchantReference: reference, amount: "1.00", currency: "USD" }, retryKey);
      setSelectedId(payment.id); setRetryKey(crypto.randomUUID());
      await refresh();
    } catch (err) { setError(readable(err)); } finally { setBusy(false); }
  }

  async function replay(event: DemoEvent) {
    setBusy(true);
    try { await api(`/demo/events/${event.id}/replay`, {}); await refresh(); }
    catch (err) { setError(readable(err)); } finally { setBusy(false); }
  }

  return <div className="merchant-cycle">
    <div className="page-heading"><div><p className="eyebrow">Gateway V3 · working rehearsal</p><h1>Merchant payment cycle</h1><p>One request, a separate checkout, and a receipt the merchant can follow.</p></div><a className="button button-secondary cycle-link" href="?view=controls#dynamic-flow-demo">Open Flow testnet demo ↗</a></div>
    <div className="cycle-mode"><span className="status status-blue">Local mock APIs</span><p>Fictional funds and provider events. The separate Flow demo uses the existing testnet connection.</p><span className={`cycle-connection ${ready ? "is-ready" : ""}`}>{ready ? "API connected" : "API unavailable"}</span></div>
    {(error || loadError) && <div className="cycle-error" role="alert">{error || loadError}</div>}
    <div className="cycle-layout">
      <section className="panel cycle-create"><p className="eyebrow">01 · Merchant creates</p><h2>Request a payment</h2><p>A fixed test amount keeps this rehearsal aligned with the Flow testnet route.</p>
        <form onSubmit={(event) => { event.preventDefault(); void createRequest(); }}>
          <label>Order reference<input required maxLength={64} pattern="[A-Za-z0-9 _\-]+" value={reference} onChange={(event) => { setReference(event.target.value); setRetryKey(crypto.randomUUID()); }} /></label>
          <div className="cycle-amount"><span>Customer pays</span><strong>1.00 <small>USD</small></strong><span>Merchant receives 1.00 test USDC</span></div>
          <div className="cycle-route"><span>Network</span><strong>Base Sepolia</strong><span>Destination</span><strong>Merchant self-custody</strong></div>
          <button className="button button-primary button-full" disabled={busy || !ready} type="submit">{busy ? "Working…" : "Create checkout"}</button>
        </form>
        <p className="cycle-fine">The API creates a unique request and checkout URL. Repeating the same request key returns the same payment.</p>
      </section>
      <section className="panel cycle-payment"><div className="panel-heading"><div><p className="eyebrow">02 → 04 · Customer pays, merchant follows</p><h2>{selected ? selected.merchantReference : "Your next payment starts here"}</h2></div>{selected && <PaymentStatus status={selected.status} />}</div>
        {selected ? <>
          <div className="cycle-checkout-link"><div><span>Separate payer page</span><code>{selected.checkoutPath}</code></div><a className="button button-primary cycle-link" href={selected.checkoutPath} target="_blank" rel="noreferrer">Open checkout ↗</a></div>
          <div className="cycle-steps">{["Request created", "Source confirmed", "Merchant settled"].map((step, index) => <div key={step} className={index === 0 || index === 1 && selected.sourceReference || index === 2 && selected.status === "settled" ? "is-complete" : ""}><span>{index + 1}</span><strong>{step}</strong></div>)}</div>
          <PaymentEvidence payment={selected} />
          <p className="cycle-boundary">Funds stop at the merchant wallet. Conversion, off-ramp and ONE account credit require a separate merchant instruction.</p>
          <details className="cycle-details"><summary>Provider states and references</summary><pre>{showJson({ paymentIntentId: selected.id, provider: selected.provider, sourceReference: selected.sourceReference, settlementReference: selected.settlementReference })}</pre></details>
        </> : <div className="cycle-empty"><span>↗</span><h3>Create a checkout, then open it in another tab.</h3><p>The payment status here will follow that checkout automatically.</p></div>}
      </section>
    </div>
    <div className="cycle-bottom-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Payment requests</h2><p>Shared across tabs; retained until the local API restarts.</p></div><span className="status status-gray">{payments.length}</span></div><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className={selected?.id === payment.id ? "cycle-selected" : ""}><td><button className="text-button" onClick={() => setSelectedId(payment.id)}>{payment.merchantReference}</button></td><td>1.00 USD</td><td><PaymentStatus status={payment.status} /></td></tr>)}</tbody></table>{!payments.length && <p className="cycle-table-empty">No requests yet.</p>}</div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Merchant event receipts</h2><p>Local delivery simulation. Duplicate events are ignored.</p></div></div><div className="cycle-events">{events.filter((event) => event.paymentIntentId === selected?.id).map((event) => <div className="cycle-event" key={event.id}><div><code>{event.type}</code><small>{event.receipt.outcome === "processed" ? "Processed once" : "Duplicate ignored"} · {event.receipt.deliveries} {event.receipt.deliveries === 1 ? "delivery" : "deliveries"}</small></div><button className="text-button" disabled={busy} onClick={() => void replay(event)}>Replay</button></div>)}{!selected && <p className="cycle-table-empty">Receipts appear as the payment progresses.</p>}</div></section>
    </div>
    <div className="cycle-existing"><strong>Existing ONE account contract · mocked</strong><span>{accounts[0] ? `${accounts[0].currency.alpha3Code} ${accounts[0].availableBalance.toLocaleString()} available · unchanged by merchant self-custody receipts` : "Account data unavailable"}</span></div>
    <details className="panel cycle-api"><summary>API activity and contract boundaries</summary><p><code>/api/v1/accounts</code> follows ONE.io’s published account shape. <code>/gateway/v3/*</code> is a proposed demo contract. <code>/demo/*</code> drives this rehearsal only.</p>{calls.length ? calls.map((call, index) => <details key={index}><summary><b>{call.method}</b> {call.path} <span>{call.status}</span></summary><pre>{showJson({ request: call.body, response: call.response })}</pre></details>) : <p>Create a request to inspect its API response.</p>}</details>
  </div>;
}

export function StandaloneCheckout({ paymentId }: { paymentId: string }) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try { const value = await api<Payment>(`/gateway/v3/payment-intents/${encodeURIComponent(paymentId)}`); if (mounted) { setPayment(value); setLoadError(""); } }
      catch (err) { if (mounted) setLoadError(readable(err)); }
    };
    void refresh(); const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [paymentId]);
  async function act(action: string) {
    setBusy(true); setError("");
    try { setPayment(await api<Payment>(`/demo/payment-intents/${encodeURIComponent(paymentId)}/actions`, { action })); }
    catch (err) { setError(readable(err)); } finally { setBusy(false); }
  }
  const unpaid = payment?.status === "awaiting_payment";
  const pending = payment?.status === "processing";
  return <div className="standalone-checkout">
    <header className="standalone-header"><a href="?view=merchant-cycle" className="cycle-brand"><span className="brand-symbol">1</span><strong>ONE</strong><span>Checkout</span></a><span className="status status-blue">Demo · no funds move</span></header>
    <main className="standalone-frame">
      <div className="standalone-intro"><p className="eyebrow">Northstar Gaming · fictional merchant</p><h1>{payment?.status === "settled" ? "Payment received" : pending ? "Your payment is on its way" : "Complete your payment"}</h1><p>{payment?.merchantReference ?? "Loading payment request…"}</p></div>
      {(error || loadError) && <div className="cycle-error" role="alert">{error || loadError}</div>}
      {payment && <>
        <div className="standalone-grid"><section className="panel standalone-pay"><div className="standalone-total"><span>Total due</span><strong>1.00 <small>USD</small></strong></div><div className="standalone-token"><span className="token-symbol">$</span><div><strong>USDC</strong><small>Base Sepolia · test network</small></div><b>1.00</b></div>
          {unpaid ? <><p className="standalone-message">Continue the demo to see payment confirmation and merchant settlement as separate steps.</p><button className="button button-primary button-full" disabled={busy || Boolean(loadError)} onClick={() => void act("source_confirmed")}>{busy ? "Processing…" : "Simulate 1.00 USDC payment"}</button><small className="standalone-no-wallet">Simulation only. No wallet connection or signature.</small></> : <div className="standalone-result"><span className={payment.status === "settled" ? "result-icon is-settled" : "result-icon"}>{payment.status === "settled" ? "✓" : pending ? "…" : "!"}</span><PaymentStatus status={payment.status} /><p>{pending ? "The source payment is confirmed. We’re waiting for the merchant to receive it." : payment.status === "settled" ? "The merchant received 1.00 test USDC in this simulation." : payment.status === "blocked" ? "Screening stopped this attempt before a source payment was submitted." : payment.status === "expired" ? "This request expired. Return to the merchant to create a new one." : "The source payment was confirmed, but settlement failed. The merchant must review this attempt."}</p></div>}
        </section><aside className="panel standalone-summary"><p className="eyebrow">Payment summary</p><h2>{payment.merchantReference}</h2><div className="cycle-route"><span>Merchant</span><strong>Northstar Gaming</strong><span>Receives</span><strong>1.00 test USDC</strong><span>Network</span><strong>Base Sepolia</strong><span>Status</span><PaymentStatus status={payment.status} /></div><div className="standalone-order-id"><span>Payment reference</span><code>{payment.id}</code></div><p>Settlement goes to the merchant wallet. No fiat conversion or ONE account credit is included.</p></aside></div>
        <section className="panel checkout-presenter"><div><p className="eyebrow">Presenter controls</p><h2>Demonstrate the next outcome</h2><p>{pending ? "A source confirmation alone must not mark the order settled." : unpaid ? "Use the payment button for the success path, or test a stopped attempt." : "This request is finished. Create another request to explore a different outcome."}</p></div><div className="page-actions">{pending && <><button className="button button-primary" disabled={busy} onClick={() => void act("settled")}>Confirm demo settlement</button><button className="button button-secondary" disabled={busy} onClick={() => void act("failed")}>Fail settlement</button></>}{unpaid && <><button className="button button-secondary" disabled={busy} onClick={() => void act("blocked")}>Block at screening</button><button className="button button-secondary" disabled={busy} onClick={() => void act("expired")}>Expire request</button></>}<a href="?view=merchant-cycle" className="button button-secondary cycle-link">Merchant view ↗</a></div></section>
      </>}
      <footer className="standalone-footer">ONE Gateway V3 · Local rehearsal · Fireblocks Flow lifecycle simulated</footer>
    </main>
  </div>;
}
