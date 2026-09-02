import { createDynamicClient, initializeClient } from "@dynamic-labs-sdk/client";
import { addEIP6963Extension } from "@dynamic-labs-sdk/evm/eip6963";
import { addEvmWindowInjectedExtension } from "@dynamic-labs-sdk/evm/window-injected";

export const DYNAMIC_ENVIRONMENT_ID = "3608a494-ff5c-4cbc-a425-ddc382e4a90a";

export const dynamicClient = createDynamicClient({
  autoInitialize: false,
  environmentId: DYNAMIC_ENVIRONMENT_ID,
  metadata: {
    name: "ONE Gateway V3 demo",
    universalLink: window.location.origin,
  },
});

// This demo intentionally registers browser-injected EVM wallets only.
// WalletConnect and Dynamic embedded-wallet/WaaS extensions are not enabled.
addEIP6963Extension(dynamicClient);
addEvmWindowInjectedExtension(dynamicClient);

void initializeClient(dynamicClient).catch(() => {
  // The reactive init status exposes the failure in the UI.
});
