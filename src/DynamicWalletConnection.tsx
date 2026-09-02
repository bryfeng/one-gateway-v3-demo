import { useMemo, useState } from "react";
import {
  useConnectAndVerifyWithWalletProvider,
  useGetAvailableWalletProvidersData,
  useGetWalletAccounts,
  useInitStatus,
  useLogout,
  useProveWalletAccountOwnership,
  useUser,
} from "@dynamic-labs-sdk/react-hooks";
import { verifyMessage } from "viem";
import { DYNAMIC_ENVIRONMENT_ID } from "./dynamicClient";

export interface DynamicWalletSelection {
  address: string;
  providerKey: string;
  providerName: string;
  verified: boolean;
}

interface DynamicWalletConnectionProps {
  compact?: boolean;
  onClear?: () => void;
  onVerified?: (wallet: DynamicWalletSelection) => void;
  selectedAddress?: string;
}

function shortAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}

function readableError(error: unknown) {
  if (!(error instanceof Error)) return "The wallet request did not complete.";
  if (/reject|cancel/i.test(error.message)) return "The wallet request was rejected. Nothing was submitted.";
  if (/screen/i.test(error.message)) return "Dynamic declined this wallet under the configured screening policy.";
  return error.message;
}

export function DynamicWalletConnection({ compact = false, onClear, onVerified, selectedAddress }: DynamicWalletConnectionProps) {
  const { data: initStatus, error: initError } = useInitStatus();
  const providersQuery = useGetAvailableWalletProvidersData();
  const walletsQuery = useGetWalletAccounts();
  const { data: user } = useUser();
  const connectMutation = useConnectAndVerifyWithWalletProvider();
  const proveMutation = useProveWalletAccountOwnership();
  const logoutMutation = useLogout();
  const [activeProviderKey, setActiveProviderKey] = useState("");
  const [freshProofAddress, setFreshProofAddress] = useState("");
  const [localError, setLocalError] = useState("");

  const providers = useMemo(() => {
    const uniqueGroups = new Set<string>();
    return (providersQuery.data ?? []).filter((provider) => {
      const isEvm = provider.chain.toUpperCase() === "EVM";
      const isWalletConnect = provider.key.toLowerCase().includes("walletconnect")
        || provider.walletProviderType.toLowerCase().includes("walletconnect");
      if (!isEvm || isWalletConnect || uniqueGroups.has(provider.groupKey)) return false;
      uniqueGroups.add(provider.groupKey);
      return true;
    });
  }, [providersQuery.data]);

  const walletAccounts = walletsQuery.data ?? [];
  const missingFields = user?.missingFields ?? [];
  const pending = connectMutation.isPending || proveMutation.isPending || logoutMutation.isPending;
  const statusLabel = initStatus === "finished"
    ? "Dynamic SDK ready"
    : initStatus === "failed"
      ? "Dynamic setup blocked"
      : "Initializing Dynamic";

  async function connect(providerKey: string, providerName: string) {
    setActiveProviderKey(providerKey);
    setLocalError("");
    connectMutation.reset();
    try {
      const wallet = await connectMutation.mutateAsync({ walletProviderKey: providerKey });
      if (!wallet.verifiedCredentialId) throw new Error("Dynamic connected the wallet but did not verify the ownership credential.");
      setFreshProofAddress(wallet.address);
      onVerified?.({
        address: wallet.address,
        providerKey,
        providerName,
        verified: true,
      });
    } catch (error) {
      setLocalError(readableError(error));
    } finally {
      setActiveProviderKey("");
    }
  }

  async function proveCurrentControl(wallet: (typeof walletAccounts)[number]) {
    setLocalError("");
    proveMutation.reset();
    try {
      const proof = await proveMutation.mutateAsync({ walletAccount: wallet });
      const isValid = await verifyMessage({
        address: wallet.address as `0x${string}`,
        message: proof.messageToSign,
        signature: proof.signature as `0x${string}`,
      });
      if (!isValid) throw new Error("The returned signature did not verify against this wallet address.");
      setFreshProofAddress(wallet.address);
      const provider = providers.find((item) => item.key === wallet.walletProviderKey);
      onVerified?.({
        address: wallet.address,
        providerKey: wallet.walletProviderKey,
        providerName: provider?.metadata.displayName ?? "Injected EVM wallet",
        verified: true,
      });
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function disconnect() {
    setLocalError("");
    try {
      await logoutMutation.mutateAsync();
      setFreshProofAddress("");
      onClear?.();
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  return (
    <section className={`dynamic-wallet-connection ${compact ? "dynamic-wallet-connection-compact" : ""}`} aria-label="Dynamic external wallet connection">
      <div className="dynamic-wallet-heading">
        <div>
          <p className="eyebrow">Live Dynamic client · external EVM wallets</p>
          <h3>{compact ? "Connect and prove wallet control" : "Dynamic wallet-authentication evidence"}</h3>
        </div>
        <span className={`dynamic-runtime-status dynamic-runtime-status-${initStatus === "finished" ? "ready" : initStatus === "failed" ? "blocked" : "pending"}`}>{statusLabel}</span>
      </div>

      {!compact ? (
        <div className="dynamic-runtime-facts">
          <div><span>Environment</span><code>{DYNAMIC_ENVIRONMENT_ID}</code></div>
          <div><span>Wallet transport</span><strong>EIP-6963 + injected fallback</strong></div>
          <div><span>WalletConnect</span><strong>Not registered</strong></div>
          <div><span>Flow credential</span><strong>Server-side only · not in this site</strong></div>
        </div>
      ) : null}

      {initStatus === "failed" ? <div className="dynamic-wallet-message dynamic-wallet-message-error"><strong>Initialization failed</strong><span>{initError?.message ?? "Check this origin and environment configuration in Dynamic."}</span></div> : null}
      {localError ? <div className="dynamic-wallet-message dynamic-wallet-message-error" role="alert"><strong>Wallet action not completed</strong><span>{localError}</span></div> : null}

      {walletAccounts.length ? (
        <div className="dynamic-connected-wallets">
          {walletAccounts.map((wallet) => {
            const hasPriorCredential = Boolean(wallet.verifiedCredentialId);
            const hasFreshProof = freshProofAddress.toLowerCase() === wallet.address.toLowerCase();
            const selected = hasFreshProof && selectedAddress?.toLowerCase() === wallet.address.toLowerCase();
            return (
              <div className={selected ? "selected" : ""} key={wallet.id}>
                <span className="dynamic-wallet-mark">{hasFreshProof ? "✓" : "!"}</span>
                <span><strong>{shortAddress(wallet.address)}</strong><small>{hasFreshProof ? "Fresh Dynamic challenge verified in this page" : hasPriorCredential ? "Prior Dynamic credential found · fresh proof required" : "Connected · fresh proof required"}</small></span>
                <button className="button button-secondary" disabled={pending || hasFreshProof} onClick={() => void proveCurrentControl(wallet)} type="button">{hasFreshProof ? (selected ? "Selected ✓" : "Fresh proof ✓") : "Prove control now"}</button>
              </div>
            );
          })}
          <button className="dynamic-disconnect-button" disabled={pending} onClick={() => void disconnect()} type="button">Disconnect Dynamic session</button>
        </div>
      ) : null}

      {initStatus === "finished" && !walletAccounts.length ? (
        providers.length ? (
          <div className="dynamic-provider-grid" role="group" aria-label="Detected external wallets">
            {providers.map((provider) => (
              <button disabled={pending} key={provider.key} onClick={() => void connect(provider.key, provider.metadata.displayName)} type="button">
                <img alt="" src={provider.metadata.icon} />
                <span><strong>{provider.metadata.displayName}</strong><small>{activeProviderKey === provider.key ? "Check your wallet…" : "Connect + sign ownership proof"}</small></span>
                <b>→</b>
              </button>
            ))}
          </div>
        ) : (
          <div className="dynamic-wallet-message"><strong>No injected EVM wallet detected</strong><span>Open this page in a browser profile with an EIP-6963 wallet extension. WalletConnect is intentionally unavailable.</span></div>
        )
      ) : null}

      {missingFields.length ? <div className="dynamic-onboarding-note"><strong>Sandbox onboarding remains separate</strong><span>Dynamic currently reports required profile fields: {missingFields.join(", ")}. Wallet ownership evidence does not, by itself, complete that onboarding.</span></div> : null}
      <p className="dynamic-scope-note"><strong>Scope:</strong> this action contacts Dynamic and requests a fresh wallet ownership signature. For a restored session, the new challenge is also verified locally against the selected EVM address; the stored credential alone cannot unlock checkout. It does not create a Flow, request a quote, call <code>eth_sendTransaction</code>, or move funds.</p>
    </section>
  );
}
