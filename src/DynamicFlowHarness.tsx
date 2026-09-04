import { useEffect, useMemo, useState } from "react";
import {
  getFlow,
  type Flow,
} from "@dynamic-labs-sdk/client";
import {
  useAttachFlowSource,
  useGetFlow,
  useGetFlowQuote,
  useGetWalletAccounts,
  useSubmitFlowTransaction,
} from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamicClient";
import type { DynamicWalletSelection } from "./DynamicWalletConnection";

const BASE_SEPOLIA_CHAIN_ID = "84532";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_SEPOLIA_EXPLORER_URL = "https://sepolia.basescan.org";
const FLOW_API_BASE_URL = (import.meta.env.VITE_FLOW_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const FLOW_TESTNET_NETWORK_READY = true;
const FLOW_ATTEMPT_STORAGE_KEY = "one-gateway-dynamic-flow-attempt-v1";
const LEGACY_FLOW_STORAGE_KEY = "one-gateway-dynamic-flow-id";

interface DynamicFlowHarnessProps {
  verifiedWallet: DynamicWalletSelection | null;
}

interface FlowBackendHealth {
  ready: boolean;
  service: string;
  route: {
    amount: string;
    asset: string;
    chainId: string;
  };
}

interface CreateFlowResponse {
  flowId: string;
}

interface StoredFlowAttempt {
  flowId: string;
  paymentIntentId: string;
}

function createPaymentIntentId() {
  return `ONE-BS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function readStoredAttempt(): StoredFlowAttempt | null {
  try {
    const rawAttempt = window.localStorage.getItem(FLOW_ATTEMPT_STORAGE_KEY);
    if (!rawAttempt) return null;
    const attempt = JSON.parse(rawAttempt) as unknown;
    if (!attempt || typeof attempt !== "object") return null;
    if (!("flowId" in attempt) || !("paymentIntentId" in attempt)) return null;
    if (typeof attempt.flowId !== "string" || !attempt.flowId) return null;
    if (typeof attempt.paymentIntentId !== "string" || !/^ONE-BS-[A-Z0-9-]{8,64}$/.test(attempt.paymentIntentId)) return null;
    return { flowId: attempt.flowId, paymentIntentId: attempt.paymentIntentId };
  } catch {
    return null;
  }
}

function storeAttempt(attempt: StoredFlowAttempt) {
  window.localStorage.setItem(FLOW_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  window.localStorage.removeItem(LEGACY_FLOW_STORAGE_KEY);
}

function clearStoredAttempt() {
  window.localStorage.removeItem(FLOW_ATTEMPT_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_FLOW_STORAGE_KEY);
}

function readableError(error: unknown) {
  if (!(error instanceof Error)) return "The Dynamic Flow action did not complete.";
  if (/reject|cancel/i.test(error.message)) {
    return "The wallet sequence was interrupted. Refresh the Flow before retrying. A USDC approval may already exist even if the payment transfer was not submitted.";
  }
  if (/network_not_enabled|network not enabled/i.test(error.message)) return "Base Sepolia is not enabled for this Dynamic environment yet.";
  if (/screen|sanction|blocked/i.test(error.message)) return "Dynamic screening stopped this Gateway attempt before signing.";
  return error.message;
}

function titleCaseState(value: string | undefined) {
  if (!value) return "Not started";
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isTerminalFlow(flow: Flow | undefined) {
  if (!flow) return false;
  return ["cancelled", "expired", "failed"].includes(flow.executionState)
    || ["completed", "failed"].includes(flow.settlementState);
}

function isValidFlowResponse(value: unknown): value is CreateFlowResponse {
  if (!value || typeof value !== "object" || !("flowId" in value)) return false;
  return typeof value.flowId === "string" && value.flowId.length > 0;
}

function shortAddress(value: string | undefined) {
  if (!value) return "Not available";
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

export function DynamicFlowHarness({ verifiedWallet }: DynamicFlowHarnessProps) {
  const walletAccountsQuery = useGetWalletAccounts();
  const attachMutation = useAttachFlowSource();
  const quoteMutation = useGetFlowQuote();
  const submitMutation = useSubmitFlowTransaction();
  const [initialAttempt] = useState<StoredFlowAttempt | null>(readStoredAttempt);
  const [paymentIntentId, setPaymentIntentId] = useState(() => initialAttempt?.paymentIntentId ?? createPaymentIntentId());
  const [flowId, setFlowId] = useState(() => initialAttempt?.flowId ?? "");
  const [flowSnapshot, setFlowSnapshot] = useState<Flow | undefined>();
  const [backendHealth, setBackendHealth] = useState<FlowBackendHealth | null>(null);
  const [backendChecking, setBackendChecking] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [signingStep, setSigningStep] = useState<"approval" | "transaction" | "">("");
  const [localMessage, setLocalMessage] = useState("Connect and freshly prove an injected wallet above. No Flow or transfer is created automatically.");
  const [localError, setLocalError] = useState("");
  const [creating, setCreating] = useState(false);
  const [screening, setScreening] = useState(false);
  const [createdInThisPage, setCreatedInThisPage] = useState(false);

  const flowQuery = useGetFlow({
    flowId: flowId || undefined,
    queryParams: {
      refetchInterval: (query) => isTerminalFlow(query.state.data) ? false : 3000,
      retry: 1,
    },
  });

  useEffect(() => {
    if (flowQuery.data) setFlowSnapshot(flowQuery.data);
  }, [flowQuery.data]);

  const flow = flowId
    ? flowSnapshot?.id === flowId
      ? flowSnapshot
      : flowQuery.data?.id === flowId
        ? flowQuery.data
        : undefined
    : undefined;
  const walletAccount = useMemo(() => {
    if (!verifiedWallet) return undefined;
    return (walletAccountsQuery.data ?? []).find((wallet) => wallet.id === verifiedWallet.walletAccountId)
      ?? (walletAccountsQuery.data ?? []).find((wallet) => wallet.address.toLowerCase() === verifiedWallet.address.toLowerCase());
  }, [verifiedWallet, walletAccountsQuery.data]);

  const pending = creating
    || screening
    || attachMutation.isPending
    || quoteMutation.isPending
    || submitMutation.isPending;
  const selectedWalletMatchesFlow = Boolean(
    walletAccount
    && flow?.fromAddress
    && walletAccount.address.toLowerCase() === flow.fromAddress.toLowerCase(),
  );
  const signingCanBeRequoted = flow?.executionState === "signing" && !flow.txHash;
  const backendRouteMatchesDemo = Boolean(
    backendHealth?.route.amount === "1.00"
    && backendHealth.route.asset === "USDC"
    && backendHealth.route.chainId === BASE_SEPOLIA_CHAIN_ID,
  );
  const canCreate = Boolean(
    FLOW_API_BASE_URL
    && FLOW_TESTNET_NETWORK_READY
    && backendHealth?.ready
    && backendRouteMatchesDemo
    && verifiedWallet?.verified
    && walletAccount
    && accessKey.length >= 8
    && !flowId
    && !pending,
  );
  const canAttach = Boolean(
    flowId
    && walletAccount
    && (flow?.executionState === "initiated" || (createdInThisPage && !flow && !flowQuery.isError))
    && !pending,
  );
  const canQuote = Boolean(
    flowId
    && selectedWalletMatchesFlow
    && flow?.riskState === "cleared"
    && (["source_attached", "quoted"].includes(flow.executionState) || signingCanBeRequoted)
    && !pending,
  );
  const canSubmit = Boolean(
    flowId
    && walletAccount
    && selectedWalletMatchesFlow
    && flow?.executionState === "quoted"
    && flow.riskState === "cleared"
    && acknowledged
    && !pending,
  );
  const flowCompleted = flow?.settlementState === "completed";
  const canAbandonPreBroadcast = Boolean(
    flow
    && !flow.txHash
    && ["initiated", "source_attached", "quoted", "signing"].includes(flow.executionState),
  );
  const canClearUnreadableAttempt = Boolean(flowId && flowQuery.isError && !pending);
  const canStartNew = Boolean(
    flowId
    && !pending
    && (isTerminalFlow(flow) || flowCompleted || canAbandonPreBroadcast || canClearUnreadableAttempt),
  );

  async function checkBackend() {
    setLocalError("");
    if (!FLOW_API_BASE_URL) {
      setBackendHealth(null);
      setLocalMessage("The safe Flow backend is built locally but its public URL has not been configured in this site.");
      return;
    }
    setBackendChecking(true);
    try {
      const response = await fetch(`${FLOW_API_BASE_URL}/health`, { headers: { Accept: "application/json" } });
      const value = await response.json() as FlowBackendHealth;
      if (!response.ok || typeof value.ready !== "boolean") throw new Error("The Flow backend health response was not valid.");
      setBackendHealth(value);
      const routeMatchesDemo = value.route?.amount === "1.00"
        && value.route.asset === "USDC"
        && value.route.chainId === BASE_SEPOLIA_CHAIN_ID;
      setLocalMessage(value.ready && routeMatchesDemo
        ? "The Flow backend is ready. The create action still requires the meeting-only access key."
        : value.ready
          ? "The Flow backend route does not match the 1.00 USDC Base Sepolia payment shown here, so creation remains locked."
        : "The Flow backend is reachable, but its private token, access key, or merchant destination is not configured.");
    } catch (error) {
      setBackendHealth(null);
      setLocalError(readableError(error));
    } finally {
      setBackendChecking(false);
    }
  }

  useEffect(() => {
    void checkBackend();
  }, []);

  async function createFlow() {
    if (!walletAccount || !verifiedWallet?.verified) return;
    setCreating(true);
    setLocalError("");
    setLocalMessage("Creating a fixed 1.00 test-USDC payment Flow. This step does not move funds.");
    try {
      const response = await fetch(`${FLOW_API_BASE_URL}/v1/flows`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-One-Demo-Key": accessKey,
        },
        body: JSON.stringify({ paymentIntentId }),
      });
      const value = await response.json() as unknown;
      if (!response.ok) {
        const message = value && typeof value === "object" && "error" in value && typeof value.error === "string"
          ? value.error
          : "The server did not create a Flow.";
        throw new Error(message);
      }
      if (!isValidFlowResponse(value)) throw new Error("The server response did not include a Dynamic Flow ID.");
      storeAttempt({ flowId: value.flowId, paymentIntentId });
      setFlowId(value.flowId);
      setCreatedInThisPage(true);
      setLocalMessage("Dynamic created the Flow with its amount, token, chain and merchant destination fixed by the server. No funds have moved.");
    } catch (error) {
      setLocalError(readableError(error));
    } finally {
      setCreating(false);
    }
  }

  async function waitForRiskDecision(activeFlowId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = await getFlow({ flowId: activeFlowId }, dynamicClient);
      setFlowSnapshot(current);
      if (current.riskState === "cleared") return current;
      if (current.riskState === "blocked") throw new Error("Dynamic screening blocked this source. Gateway quote and signing remain unavailable.");
      if (current.riskState === "review") throw new Error("Dynamic screening returned review. This Gateway attempt stops for manual review before quote or signing.");
      if (["cancelled", "expired", "failed"].includes(current.executionState)) throw new Error(`The Flow ended in ${current.executionState}. Create a new attempt.`);
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    throw new Error("Dynamic screening is still pending. Refresh the Flow state before continuing.");
  }

  async function attachAndScreen() {
    if (!flowId || !walletAccount) return;
    setScreening(true);
    setLocalError("");
    setLocalMessage("Attaching the verified payer address and waiting for Dynamic’s risk decision. No funds move in this step.");
    try {
      const attached = await attachMutation.mutateAsync({
        flowId,
        sourceType: "wallet",
        fromAddress: walletAccount.address,
        fromChainId: BASE_SEPOLIA_CHAIN_ID,
        fromChainName: "EVM",
      });
      setFlowSnapshot(attached.flow);
      if (!attached.flow.fromAddress || attached.flow.fromAddress.toLowerCase() !== walletAccount.address.toLowerCase()) {
        throw new Error("Dynamic did not bind this Flow to the freshly verified wallet. Quote and signing remain unavailable.");
      }
      if (attached.flow.toAddress?.toLowerCase() === walletAccount.address.toLowerCase()) {
        throw new Error("The configured merchant destination matches the payer. Use a distinct merchant-controlled test address.");
      }
      const screened = await waitForRiskDecision(flowId);
      setLocalMessage(screened.riskState === "cleared"
        ? "Dynamic cleared the source for this Flow. A quote may now be requested."
        : `Dynamic screening is ${screened.riskState}.`);
    } catch (error) {
      setLocalError(readableError(error));
    } finally {
      setScreening(false);
    }
  }

  async function requestQuote() {
    if (!flowId || !walletAccount || !selectedWalletMatchesFlow) return;
    setLocalError("");
    setLocalMessage(signingCanBeRequoted
      ? "Refreshing the Flow after an interrupted wallet sequence. This replaces the old signing payload and does not move funds."
      : "Requesting a real same-token Base Sepolia quote. No funds move in this step.");
    try {
      const quoted = await quoteMutation.mutateAsync({
        flowId,
        fromChainId: BASE_SEPOLIA_CHAIN_ID,
        fromTokenAddress: BASE_SEPOLIA_USDC,
      });
      if (quoted.riskState !== "cleared") throw new Error(`Dynamic screening is ${quoted.riskState}; signing remains unavailable.`);
      setFlowSnapshot(quoted);
      setLocalMessage("Quote received. Verify the payer, merchant destination, amount and Base Sepolia network before requesting the wallet transaction.");
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function submitFlow() {
    if (!flowId || !walletAccount || !flow?.fromAddress) return;
    if (walletAccount.address.toLowerCase() !== flow.fromAddress.toLowerCase()) {
      setLocalError("The selected wallet does not match the wallet Dynamic screened for this Flow. Re-select and freshly prove the original wallet.");
      return;
    }
    setLocalError("");
    setSigningStep("");
    setLocalMessage("Dynamic is preparing the transaction. The wallet may request a USDC approval before the payment signature; review each prompt separately.");
    try {
      const broadcasted = await submitMutation.mutateAsync({
        flowId,
        walletAccount,
        onStepChange: setSigningStep,
      });
      setFlowSnapshot(broadcasted);
      setLocalMessage("The wallet returned a testnet transaction hash. Dynamic settlement remains separate until its settlement state is completed.");
      await flowQuery.refetch();
    } catch (error) {
      let recoveryDetail = "";
      try {
        const current = await getFlow({ flowId }, dynamicClient);
        setFlowSnapshot(current);
        if (current.executionState === "signing" && !current.txHash) {
          recoveryDetail = " Dynamic reports that the Flow is still in signing; use Recover quote before another wallet attempt.";
        } else if (["broadcasted", "source_confirmed"].includes(current.executionState)) {
          recoveryDetail = " Dynamic reports that a source transaction already exists; refresh and wait for settlement instead of signing again.";
        }
      } catch {
        recoveryDetail = " Refresh the Flow state before deciding whether to retry.";
      }
      setLocalError(`${readableError(error)}${recoveryDetail}`);
    } finally {
      setSigningStep("");
    }
  }

  async function refreshFlow() {
    setLocalError("");
    const result = await flowQuery.refetch();
    if (result.error) setLocalError(readableError(result.error));
    else setLocalMessage("Flow state refreshed from Dynamic.");
  }

  function startNewAttempt() {
    if (!canStartNew) return;
    if ((canAbandonPreBroadcast || canClearUnreadableAttempt) && !window.confirm(
      "Abandon this local attempt? This clears the browser's ONE-intent and Flow linkage, but it does not cancel the Flow in Dynamic or revoke any token approval already signed on-chain.",
    )) return;
    clearStoredAttempt();
    setFlowId("");
    setFlowSnapshot(undefined);
    setPaymentIntentId(createPaymentIntentId());
    setAcknowledged(false);
    setSigningStep("");
    setCreatedInThisPage(false);
    setLocalError("");
    setLocalMessage("New local payment intent prepared. No Dynamic Flow or transfer has been created.");
    attachMutation.reset();
    quoteMutation.reset();
    submitMutation.reset();
  }

  const backendLabel = !FLOW_API_BASE_URL
    ? "URL not published"
    : backendChecking
      ? "Checking"
      : backendHealth?.ready && backendRouteMatchesDemo
        ? "Ready"
        : backendHealth?.ready
          ? "Route mismatch"
        : backendHealth
          ? "Secrets pending"
          : "Unavailable";

  return (
    <section className="dynamic-flow-harness" id="dynamic-flow-demo" aria-label="Dynamic Flow Base Sepolia evidence harness">
      <div className="dynamic-flow-harness-heading">
        <div>
          <p className="eyebrow">Optional live proof · Base Sepolia</p>
          <h3>Dynamic Flow · 1.00 test USDC to a fixed merchant destination</h3>
          <p>Wallet source, screening, quote, wallet submission and settlement are recorded as separate evidence.</p>
        </div>
        <span className={`status ${flowCompleted ? "status-green" : "status-blue"}`}>{flowCompleted ? "Settlement completed" : "Testnet only"}</span>
      </div>

      <div className="dynamic-flow-readiness">
        <div><span>Flow entitlement</span><strong>Enabled</strong><small>Environment 3608a494…</small></div>
        <div><span>Safe create backend</span><strong>{backendLabel}</strong><small>Private <code>flow.write</code> token only</small></div>
        <div><span>Dynamic network</span><strong>{FLOW_TESTNET_NETWORK_READY ? "Base Sepolia enabled" : "Base Sepolia pending"}</strong><small>Chain ID {BASE_SEPOLIA_CHAIN_ID}</small></div>
        <div><span>Fixed route</span><strong>USDC → USDC</strong><small>No swap or bridge · testnet only</small></div>
      </div>

      <div className="testnet-scope-note">
        <strong>Screened Gateway tier only</strong>
        <p>A cleared Dynamic risk state unlocks quote and signing. A blocked or review result stops this ONE Gateway attempt before funds move. The self-custody-only alternative remains outside Dynamic Flow and outside downstream ONE services.</p>
      </div>

      <div className="dynamic-flow-workspace">
        <form className="dynamic-flow-controls" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Meeting-only backend access key</span>
            <input autoComplete="off" onChange={(event) => setAccessKey(event.target.value)} placeholder="Enter at runtime · never stored" type="password" value={accessKey} />
            <small>The key stays in page memory and is sent only to the narrow Flow-create endpoint.</small>
          </label>

          <div className="dynamic-flow-fixed-route">
            <div><span>ONE payment intent</span><code>{paymentIntentId}</code></div>
            <div><span>Payer source</span><strong>{verifiedWallet?.verified ? `${verifiedWallet.providerName} · ${shortAddress(verifiedWallet.address)}` : "Fresh Dynamic wallet proof required"}</strong></div>
            <div><span>Merchant destination</span><strong>{flow?.toAddress ? shortAddress(flow.toAddress) : "Fixed on the server; revealed by the Flow"}</strong></div>
            <div><span>Payment</span><strong>1.00 test USDC · Base Sepolia</strong></div>
          </div>

          {flow?.fromAddress && !selectedWalletMatchesFlow ? (
            <div className="dynamic-flow-wallet-warning" role="alert">
              <strong>Wallet does not match the screened source</strong>
              <span>Dynamic attached {shortAddress(flow.fromAddress)}. Re-select and freshly prove that wallet before quoting or signing.</span>
            </div>
          ) : null}

          <div className="dynamic-flow-actions">
            <button className="button button-secondary" disabled={!canCreate} onClick={() => void createFlow()} type="button">1 · Create Flow</button>
            <button className="button button-secondary" disabled={!canAttach} onClick={() => void attachAndScreen()} type="button">2 · Attach + screen</button>
            <button className="button button-secondary" disabled={!canQuote} onClick={() => void requestQuote()} type="button">3 · {signingCanBeRequoted ? "Recover quote" : "Get quote"}</button>
            <button className="button button-primary" disabled={!canSubmit} onClick={() => void submitFlow()} type="button">4 · {signingStep === "approval" ? "Approve USDC" : signingStep === "transaction" ? "Submit in wallet" : "Review + submit"}</button>
          </div>

          <label className="dynamic-flow-acknowledgement">
            <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
            <span>I verified Base Sepolia, the fixed merchant destination and the 1.00 test-USDC amount. The wallet still controls final approval.</span>
          </label>

          <div className={`harness-message harness-message-${localError ? "error" : flowCompleted ? "confirmed" : pending ? "submitted" : "idle"}`} aria-live="polite">
            <strong>{localError ? "Flow action not completed" : "Dynamic Flow status"}</strong>
            <span>{localError || localMessage}</span>
          </div>

          <div className="dynamic-flow-secondary-actions">
            <button className="text-button" disabled={backendChecking} onClick={() => void checkBackend()} type="button">Check backend</button>
            <button className="text-button" disabled={!flowId || flowQuery.isFetching} onClick={() => void refreshFlow()} type="button">Refresh Flow state</button>
            <button className="text-button" disabled={!canStartNew} onClick={startNewAttempt} type="button">{canClearUnreadableAttempt ? "Clear unreadable attempt" : canAbandonPreBroadcast && !isTerminalFlow(flow) ? "Abandon local attempt" : "Start new test attempt"}</button>
          </div>
        </form>

        <aside className="test-proof-record dynamic-flow-proof">
          <div className="test-proof-heading">
            <div><p className="eyebrow">Dynamic evidence record</p><h3>{flowId || "Flow not created"}</h3></div>
            <span className={`status ${flow?.riskState === "cleared" ? "status-green" : flow?.riskState === "blocked" || flow?.riskState === "review" ? "status-red" : "status-gray"}`}>{titleCaseState(flow?.riskState)}</span>
          </div>
          <dl>
            <div><dt>ONE intent</dt><dd><code>{paymentIntentId}</code></dd></div>
            <div><dt>Dynamic Flow ID</dt><dd><code>{flowId || "Not created"}</code></dd></div>
            <div><dt>Screened payer</dt><dd><code>{flow?.fromAddress || "Not attached"}</code><small>Read from Dynamic after source attachment, not asserted by the create endpoint.</small></dd></div>
            <div><dt>Merchant destination</dt><dd><code>{flow?.toAddress || "Fixed by backend · pending Flow"}</code><small>Dynamic does not supply or own this wallet.</small></dd></div>
            <div><dt>Quote</dt><dd>{flow?.quote ? `${flow.quote.fromAmount} → ${flow.quote.toAmount} test USDC` : "Not quoted"}<small>{flow?.quote ? `Version ${flow.quote.version}` : "Quote expires before signing"}</small></dd></div>
            <div><dt>Execution state</dt><dd>{titleCaseState(flow?.executionState)}</dd></div>
            <div><dt>Risk state</dt><dd>{titleCaseState(flow?.riskState)}</dd></div>
            <div><dt>Settlement state</dt><dd>{titleCaseState(flow?.settlementState)}<small><code>source_confirmed</code> is not final settlement.</small></dd></div>
            <div><dt>Source transaction</dt><dd><code>{flow?.txHash || "Not broadcast"}</code>{flow?.txHash ? <a href={`${BASE_SEPOLIA_EXPLORER_URL}/tx/${flow.txHash}`} rel="noreferrer" target="_blank">View source on BaseScan</a> : null}</dd></div>
            <div><dt>Settlement transaction</dt><dd><code>{flow?.settlementTxHash || "Not settled"}</code>{flow?.settlementTxHash ? <a href={`${BASE_SEPOLIA_EXPLORER_URL}/tx/${flow.settlementTxHash}`} rel="noreferrer" target="_blank">View settlement on BaseScan</a> : null}</dd></div>
            {flow?.depositAddress ? <div><dt>Deposit address</dt><dd><code>{flow.depositAddress}</code><small>Shown only because Dynamic returned one.</small></dd></div> : null}
          </dl>
          <div className="proof-linkage-note">
            <strong>What completion proves</strong>
            <p>A completed Flow plus BaseScan receipt evidences the configured route and delivery to the recorded address. Merchant ownership still requires separate wallet-policy or signer evidence; the transaction hash alone does not establish legal ownership.</p>
          </div>
        </aside>
      </div>

      <div className="dynamic-flow-footer-links">
        <a href="https://faucet.circle.com/" rel="noreferrer" target="_blank">Circle test-USDC faucet</a>
        <a href={`${BASE_SEPOLIA_EXPLORER_URL}/token/${BASE_SEPOLIA_USDC}`} rel="noreferrer" target="_blank">Base Sepolia USDC contract</a>
        <code>{BASE_SEPOLIA_USDC}</code>
      </div>
    </section>
  );
}
