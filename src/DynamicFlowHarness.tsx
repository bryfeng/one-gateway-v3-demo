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
import { getAddress, isAddress } from "viem";
import { dynamicClient } from "./dynamicClient";
import type { DynamicWalletSelection } from "./DynamicWalletConnection";

const BASE_SEPOLIA_CHAIN_ID = "84532";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_SEPOLIA_EXPLORER_URL = "https://sepolia.basescan.org";
const FLOW_API_BASE_URL = (import.meta.env.VITE_FLOW_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const FLOW_TESTNET_NETWORK_READY = true;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FLOW_ATTEMPT_STORAGE_KEY = "one-gateway-dynamic-flow-attempt-v2";
const LEGACY_FLOW_STORAGE_KEYS = ["one-gateway-dynamic-flow-attempt-v1", "one-gateway-dynamic-flow-id"];

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

interface VerifyFlowResponse {
  verified: true;
}

interface StoredFlowAttempt {
  flowId: string;
  paymentIntentId: string;
  settlementDestination: string;
}

function createPaymentIntentId() {
  return `ONE-BS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeSettlementDestination(value: string) {
  const candidate = value.trim();
  if (!isAddress(candidate)) return "";
  const normalized = getAddress(candidate);
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower === ZERO_ADDRESS || normalizedLower === BASE_SEPOLIA_USDC.toLowerCase()) return "";
  return normalized;
}

function readStoredAttempt(): StoredFlowAttempt | null {
  try {
    const rawAttempt = window.localStorage.getItem(FLOW_ATTEMPT_STORAGE_KEY);
    if (!rawAttempt) return null;
    const attempt = JSON.parse(rawAttempt) as unknown;
    if (!attempt || typeof attempt !== "object") return null;
    if (!("flowId" in attempt) || !("paymentIntentId" in attempt) || !("settlementDestination" in attempt)) return null;
    if (typeof attempt.flowId !== "string" || !attempt.flowId) return null;
    if (typeof attempt.paymentIntentId !== "string" || !/^ONE-BS-[A-Z0-9-]{8,64}$/.test(attempt.paymentIntentId)) return null;
    if (typeof attempt.settlementDestination !== "string") return null;
    const settlementDestination = normalizeSettlementDestination(attempt.settlementDestination);
    if (!settlementDestination) return null;
    return { flowId: attempt.flowId, paymentIntentId: attempt.paymentIntentId, settlementDestination };
  } catch {
    return null;
  }
}

function storeAttempt(attempt: StoredFlowAttempt) {
  window.localStorage.setItem(FLOW_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  LEGACY_FLOW_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

function clearStoredAttempt() {
  window.localStorage.removeItem(FLOW_ATTEMPT_STORAGE_KEY);
  LEGACY_FLOW_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
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

function isValidVerifyFlowResponse(value: unknown): value is VerifyFlowResponse {
  return Boolean(value && typeof value === "object" && "verified" in value && value.verified === true);
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
  const [settlementDestination, setSettlementDestination] = useState(() => initialAttempt?.settlementDestination ?? "");
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
  const [destinationChecking, setDestinationChecking] = useState(false);
  const [destinationVerified, setDestinationVerified] = useState(false);
  const [createdInThisPage, setCreatedInThisPage] = useState(false);

  const flowQuery = useGetFlow({
    flowId: flowId || undefined,
    queryParams: {
      refetchInterval: (query) => isTerminalFlow(query.state.data) ? false : 3000,
      retry: 1,
    },
  });

  useEffect(() => {
    const incoming = flowQuery.data;
    if (!incoming) return;
    setFlowSnapshot(incoming);
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
    || destinationChecking
    || attachMutation.isPending
    || quoteMutation.isPending
    || submitMutation.isPending;
  const normalizedSettlementDestination = normalizeSettlementDestination(settlementDestination);
  const selectedPayerAddress = walletAccount?.address || verifiedWallet?.address || "";
  const payerDiffersFromDestination = Boolean(
    selectedPayerAddress
    && normalizedSettlementDestination
    && selectedPayerAddress.toLowerCase() !== normalizedSettlementDestination.toLowerCase(),
  );
  const settlementDestinationError = !settlementDestination.trim()
    ? ""
    : !normalizedSettlementDestination
      ? "Enter a valid EVM address. The zero address and USDC contract are not destinations."
      : selectedPayerAddress && !payerDiffersFromDestination
        ? "Use a settlement destination different from the payer wallet."
        : "";
  const selectedWalletMatchesFlow = Boolean(
    walletAccount
    && flow?.fromAddress
    && walletAccount.address.toLowerCase() === flow.fromAddress.toLowerCase(),
  );
  const resolvedSettlementDestination = normalizeSettlementDestination(flow?.settlement?.toAddress ?? "");
  const resolvedSettlementDestinationMatches = Boolean(
    normalizedSettlementDestination
    && resolvedSettlementDestination
    && resolvedSettlementDestination.toLowerCase() === normalizedSettlementDestination.toLowerCase(),
  );
  const resolvedSettlementDestinationConflicts = Boolean(
    resolvedSettlementDestination && !resolvedSettlementDestinationMatches,
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
    && normalizedSettlementDestination
    && payerDiffersFromDestination
    && !settlementDestinationError
    && accessKey.length > 0
    && !flowId
    && !pending,
  );
  const canAttach = Boolean(
    flowId
    && walletAccount
    && payerDiffersFromDestination
    && (
      flow?.executionState === "initiated"
      || (createdInThisPage && !flow && !flowQuery.isError)
    )
    && !pending,
  );
  const canQuote = Boolean(
    flowId
    && selectedWalletMatchesFlow
    && payerDiffersFromDestination
    && flow?.riskState === "cleared"
    && (flow.executionState === "source_attached" || signingCanBeRequoted)
    && accessKey.length > 0
    && !pending,
  );
  const canVerifyDestination = Boolean(
    flowId
    && selectedWalletMatchesFlow
    && payerDiffersFromDestination
    && flow?.riskState === "cleared"
    && flow.executionState === "quoted"
    && accessKey.length > 0
    && !destinationVerified
    && !pending,
  );
  const canSubmit = Boolean(
    flowId
    && walletAccount
    && selectedWalletMatchesFlow
    && payerDiffersFromDestination
    && destinationVerified
    && !resolvedSettlementDestinationConflicts
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
        : "The Flow backend is reachable, but its private token or access key is not configured.");
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
    if (!walletAccount || !verifiedWallet?.verified || !normalizedSettlementDestination || settlementDestinationError) return;
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
        body: JSON.stringify({ paymentIntentId, settlementDestination: normalizedSettlementDestination }),
      });
      const value = await response.json() as unknown;
      if (!response.ok) {
        const message = value && typeof value === "object" && "error" in value && typeof value.error === "string"
          ? value.error
          : "The server did not create a Flow.";
        throw new Error(message);
      }
      if (!isValidFlowResponse(value)) throw new Error("The server response did not include a Dynamic Flow ID.");
      storeAttempt({ flowId: value.flowId, paymentIntentId, settlementDestination: normalizedSettlementDestination });
      setFlowId(value.flowId);
      setSettlementDestination(normalizedSettlementDestination);
      setCreatedInThisPage(true);
      setLocalMessage("Flow created for this settlement destination. No funds have moved.");
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
    if (!flowId || !walletAccount || !normalizedSettlementDestination || !payerDiffersFromDestination) return;
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

  async function verifyDestination(activeFlowId: string) {
    setDestinationChecking(true);
    try {
      const response = await fetch(`${FLOW_API_BASE_URL}/v1/flows/verify`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-One-Demo-Key": accessKey,
        },
        body: JSON.stringify({
          flowId: activeFlowId,
          paymentIntentId,
          settlementDestination: normalizedSettlementDestination,
        }),
      });
      const value = await response.json() as unknown;
      if (!response.ok) {
        const message = value && typeof value === "object" && "error" in value && typeof value.error === "string"
          ? value.error
          : "The server could not verify the Flow destination.";
        throw new Error(message);
      }
      if (!isValidVerifyFlowResponse(value)) throw new Error("The Flow destination verification response was not valid.");
      setDestinationVerified(true);
    } finally {
      setDestinationChecking(false);
    }
  }

  async function verifyQuotedDestination() {
    if (!flowId || !canVerifyDestination) return;
    setLocalError("");
    setLocalMessage("Verifying the merchant destination against Dynamic’s immutable server record. No funds move in this step.");
    try {
      await verifyDestination(flowId);
      setLocalMessage("Merchant destination verified from Dynamic’s immutable server record. The wallet payment may now be requested.");
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function requestQuote() {
    if (!flowId || !walletAccount || !selectedWalletMatchesFlow || !payerDiffersFromDestination || !accessKey) return;
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
      if (!quoted.fromAddress || quoted.fromAddress.toLowerCase() !== walletAccount.address.toLowerCase()) {
        throw new Error("Dynamic returned a quote for a different payer wallet. Signing remains unavailable.");
      }
      setFlowSnapshot(quoted);
      setLocalMessage("Quote received. Verifying the merchant destination against Dynamic’s immutable server record.");
      await verifyDestination(flowId);
      setLocalMessage("Quote received and merchant destination verified. Review the payer, amount and Base Sepolia network before requesting the wallet transaction.");
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function submitFlow() {
    if (!flowId || !walletAccount || !flow?.fromAddress || !payerDiffersFromDestination || !destinationVerified || resolvedSettlementDestinationConflicts) return;
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
    setSettlementDestination("");
    setAcknowledged(false);
    setDestinationVerified(false);
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
    <section className="dynamic-flow-harness dynamic-flow-launcher" id="dynamic-flow-demo" aria-label="Fireblocks Flow Base Sepolia launcher">
      <div className="dynamic-flow-harness-heading">
        <div>
          <p className="eyebrow">Fireblocks Flow via Dynamic</p>
          <h2>Send 1.00 test USDC</h2>
          <p>Base Sepolia to the settlement destination you enter.</p>
        </div>
        <span className={`status ${backendHealth?.ready && backendRouteMatchesDemo ? "status-green" : "status-gray"}`}>{backendLabel}</span>
      </div>

      <form className="dynamic-flow-controls" onSubmit={(event) => event.preventDefault()}>
        <label className="dynamic-flow-destination">
          <span>Settlement destination</span>
          <input
            aria-invalid={Boolean(settlementDestinationError)}
            autoComplete="off"
            disabled={Boolean(flowId)}
            onChange={(event) => setSettlementDestination(event.target.value)}
            placeholder="0x…"
            spellCheck={false}
            value={settlementDestination}
          />
          <small>{settlementDestinationError || "Editable until the Flow is created. Entering an address does not prove who owns it."}</small>
        </label>

        <details className="dynamic-flow-presenter-access">
          <summary>Presenter access</summary>
          <label>
            <span>Meeting-only key</span>
            <input autoComplete="off" onChange={(event) => setAccessKey(event.target.value)} placeholder="Enter at runtime · never stored" type="password" value={accessKey} />
            <small>Held in page memory and sent only to the Flow Worker for creation and destination verification.</small>
          </label>
        </details>

        {flow?.fromAddress && !selectedWalletMatchesFlow && !isTerminalFlow(flow) ? (
          <div className="dynamic-flow-wallet-warning" role="alert">
            <strong>Reconnect the screened payer wallet</strong>
            <span>Dynamic screened {shortAddress(flow.fromAddress)}. Freshly prove that same wallet before continuing.</span>
          </div>
        ) : null}
        {resolvedSettlementDestinationConflicts ? (
          <div className="dynamic-flow-wallet-warning" role="alert">
            <strong>Settlement destination mismatch</strong>
            <span>Dynamic’s resolved settlement record does not match the verified merchant destination.</span>
          </div>
        ) : null}

        {flow?.executionState === "quoted" ? (
          <label className="dynamic-flow-acknowledgement">
            <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
            <span>I checked the Base Sepolia destination and 1.00 test-USDC amount.</span>
          </label>
        ) : null}

        <div className="dynamic-flow-primary-action">
          {pending ? <button className="button button-primary" disabled type="button">Working…</button> : !flowId ? (
            <button className="button button-primary" disabled={!canCreate} onClick={() => void createFlow()} type="button">Start Fireblocks Flow</button>
          ) : (isTerminalFlow(flow) || flowCompleted) && canStartNew ? (
            <button className="button button-primary" onClick={startNewAttempt} type="button">Start new test</button>
          ) : canAttach ? (
            <button className="button button-primary" onClick={() => void attachAndScreen()} type="button">Attach wallet + screen</button>
          ) : canQuote ? (
            <button className="button button-primary" onClick={() => void requestQuote()} type="button">{signingCanBeRequoted ? "Recover quote" : "Get quote"}</button>
          ) : flow?.executionState === "quoted" && !destinationVerified ? (
            <button className="button button-primary" disabled={!canVerifyDestination} onClick={() => void verifyQuotedDestination()} type="button">Verify destination</button>
          ) : flow?.executionState === "quoted" ? (
            <button className="button button-primary" disabled={!canSubmit} onClick={() => void submitFlow()} type="button">{signingStep === "approval" ? "Approve USDC" : signingStep === "transaction" ? "Submit in wallet" : "Review & pay in wallet"}</button>
          ) : (
            <button className="button button-secondary" disabled={flowQuery.isFetching} onClick={() => void refreshFlow()} type="button">Refresh Flow status</button>
          )}
          <small>{flow?.executionState === "quoted" && !destinationVerified && !accessKey
            ? "Re-enter presenter access to verify the locked merchant destination."
            : !flowId && !accessKey
              ? "Add presenter access, a destination, and a verified payer wallet to start."
              : "Creating, screening, quoting and destination verification do not move funds. The payer approves payment in its wallet."}</small>
        </div>

        {localError || pending || flowId ? (
          <div className={`harness-message harness-message-${localError ? "error" : flowCompleted ? "confirmed" : pending ? "submitted" : "idle"}`} aria-live="polite">
            <strong>{localError ? "Flow action not completed" : "Flow status"}</strong>
            <span>{localError || localMessage}</span>
          </div>
        ) : null}
      </form>

      {flowId ? (
        <div className="dynamic-flow-progress" aria-label="Flow progress">
          {[
            { label: "Created", complete: true },
            { label: "Screened", complete: flow?.riskState === "cleared" },
            { label: "Submitted", complete: Boolean(flow?.txHash) },
            { label: "Settled", complete: flowCompleted },
          ].map((step) => <span className={step.complete ? "complete" : ""} key={step.label}>{step.complete ? "✓" : "○"} {step.label}</span>)}
        </div>
      ) : null}

      {flowId ? (
        <div className="dynamic-flow-result">
          <div><span>Flow ID</span><code>{flowId}</code></div>
          <div><span>ONE intent</span><code>{paymentIntentId}</code></div>
          <div><span>{destinationVerified ? "Verified merchant destination" : "Merchant destination"}</span><code>{normalizedSettlementDestination}</code></div>
          <div><span>State</span><strong>{titleCaseState(flow?.executionState)} · {titleCaseState(flow?.settlementState)}</strong></div>
          {flow?.txHash ? <a href={`${BASE_SEPOLIA_EXPLORER_URL}/tx/${flow.txHash}`} rel="noreferrer" target="_blank">Source transaction ↗</a> : null}
          {flow?.settlementTxHash ? <a href={`${BASE_SEPOLIA_EXPLORER_URL}/tx/${flow.settlementTxHash}`} rel="noreferrer" target="_blank">Settlement transaction ↗</a> : null}
          <small>Source confirmation is not final settlement. Delivery to an address does not, by itself, prove ownership.</small>
          <div className="dynamic-flow-secondary-actions">
            <button className="text-button" disabled={flowQuery.isFetching} onClick={() => void refreshFlow()} type="button">Refresh</button>
            <button className="text-button" disabled={!canStartNew} onClick={startNewAttempt} type="button">{canClearUnreadableAttempt ? "Clear attempt" : "Start new"}</button>
          </div>
        </div>
      ) : null}

      <div className="dynamic-flow-footer-links">
        <a href="https://faucet.circle.com/" rel="noreferrer" target="_blank">Get test USDC</a>
        <button className="text-button" disabled={backendChecking} onClick={() => void checkBackend()} type="button">Check service</button>
      </div>
    </section>
  );
}
