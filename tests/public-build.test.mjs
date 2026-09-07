import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const dynamicClientSource = await readFile(new URL("../src/dynamicClient.ts", import.meta.url), "utf8");
const dynamicWalletSource = await readFile(new URL("../src/DynamicWalletConnection.tsx", import.meta.url), "utf8");
const dynamicFlowSource = await readFile(new URL("../src/DynamicFlowHarness.tsx", import.meta.url), "utf8");
const flowWorkerSource = await readFile(new URL("../flow-worker/src/index.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const builtHtml = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const controlsViewSource = appSource.slice(
  appSource.indexOf('{view === "controls"'),
  appSource.indexOf('{view === "developer"'),
);

test("build produces a static entry point for GitHub Pages", () => {
  assert.match(builtHtml, /ONE Gateway V3/);
  assert.match(builtHtml, /\.\/assets\//);
});

test("public prototype retains the key merchant journeys", () => {
  for (const label of [
    "Create payment request",
    "Preview payment link",
    "Create one-time payout",
    "Create batch payout",
    "Exchange",
    "Reporting",
    "Smart Account",
    "Flow demo",
  ]) {
    assert.match(appSource, new RegExp(label));
  }
});

test("Flow demo stays focused on the live Fireblocks Flow path", () => {
  for (const label of [
    "Fireblocks Flow",
    "Create a 1.00 test-USDC payment on Base Sepolia through Dynamic",
    "DynamicWalletConnection compact",
    "DynamicFlowHarness",
  ]) {
    assert.match(controlsViewSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const removedLabel of ["Ownership and control matrix", "ONE-owned acceptance", "Injected-wallet Base Sepolia harness"]) {
    assert.doesNotMatch(controlsViewSource, new RegExp(removedLabel));
  }
});

test("Dynamic uses the supplied environment and external injected wallets only", () => {
  assert.match(dynamicClientSource, /3608a494-ff5c-4cbc-a425-ddc382e4a90a/);
  assert.match(dynamicClientSource, /@dynamic-labs-sdk\/evm\/eip6963/);
  assert.match(dynamicClientSource, /addEIP6963Extension\(dynamicClient\)/);
  assert.match(dynamicClientSource, /@dynamic-labs-sdk\/evm\/window-injected/);
  assert.match(dynamicClientSource, /addEvmWindowInjectedExtension\(dynamicClient\)/);
  assert.doesNotMatch(dynamicClientSource, /addEvmExtension|addWalletConnectEvmExtension|addWaasEvmExtension|createWaasWalletAccounts/);
  assert.match(mainSource, /QueryClientProvider/);
  assert.match(mainSource, /DynamicProvider client=\{dynamicClient\}/);
});

test("Dynamic wallet ownership is real but cannot submit a payment", () => {
  for (const label of [
    "useConnectAndVerifyWithWalletProvider",
    "Connect + sign ownership proof",
    "useProveWalletAccountOwnership",
    "Fresh Dynamic challenge verified in this page",
    "the stored credential alone cannot unlock checkout",
    "WalletConnect is intentionally unavailable",
    "It does not create a Flow",
  ]) {
    assert.match(dynamicWalletSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(dynamicWalletSource, /method:\s*["']eth_sendTransaction|useSubmitFlowTransaction|useAttachFlowSource|useGetFlowQuote/);
  assert.match(appSource, /disabled=\{method === "Wallet" && !verifiedWallet\?\.verified\}/);
  assert.match(appSource, /Continue to illustrative quote/);
  assert.match(appSource, /Continue illustrative payment status/);
  assert.match(appSource, /dynamicWalletNetworks = new Set\(\["Ethereum"\]\)/);
  assert.match(appSource, /availableAssets = method === "Wallet" \? dynamicWalletAssets : cryptoAssets/);
  assert.match(appSource, /only Ethereum is exposed by this Dynamic environment/);
  assert.doesNotMatch(appSource, /Simulate wallet approval/);
});

test("public Dynamic integration contains no server credential", () => {
  const publicDynamicSource = `${dynamicClientSource}\n${dynamicWalletSource}\n${dynamicFlowSource}\n${mainSource}\n${appSource}`;
  assert.doesNotMatch(publicDynamicSource, /Authorization\s*:\s*["'`]Bearer/i);
  assert.doesNotMatch(publicDynamicSource, /dyn_[A-Za-z0-9_-]{8,}/);
  assert.doesNotMatch(publicDynamicSource, /DYNAMIC_API_(?:KEY|TOKEN)/);
  assert.match(dynamicFlowSource, /Presenter access/);
  assert.match(dynamicFlowSource, /Meeting-only key/);
  assert.match(dynamicFlowSource, /accessKey\.length > 0/);
  assert.doesNotMatch(dynamicFlowSource, /accessKey\.length >= 8/);
});

test("Dynamic Flow test harness preserves the real risk and settlement boundaries", () => {
  for (const label of [
    "VITE_FLOW_API_BASE_URL",
    "FLOW_TESTNET_NETWORK_READY = true",
    "useAttachFlowSource",
    "useGetFlowQuote",
    "useSubmitFlowTransaction",
    "Fireblocks Flow via Dynamic",
    "Settlement destination",
    "Start Fireblocks Flow",
    "Attach wallet + screen",
    "Get quote",
    "Verify destination",
    "Review & pay in wallet",
    "Recover quote",
    "Settlement destination mismatch",
    "Merchant destination",
    "verifyDestination",
    "destinationVerified",
    "resolvedSettlementDestination",
    "payerDiffersFromDestination",
    "source_confirmed",
    "settlementState === \"completed\"",
    "Source confirmation is not final settlement",
    "Delivery to an address does not, by itself, prove ownership",
  ]) {
    const combined = `${dynamicFlowSource}\n${appSource}`;
    assert.match(combined, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(dynamicFlowSource, /fromChainId:\s*BASE_SEPOLIA_CHAIN_ID/);
  assert.match(dynamicFlowSource, /fromTokenAddress:\s*BASE_SEPOLIA_USDC/);
  assert.match(dynamicFlowSource, /riskState === "cleared"/);
  assert.match(dynamicFlowSource, /flow\?\.executionState === "initiated"/);
  assert.match(dynamicFlowSource, /createdInThisPage && !flow && !flowQuery\.isError/);
  assert.match(dynamicFlowSource, /selectedWalletMatchesFlow/);
  assert.match(dynamicFlowSource, /walletAccount\.address\.toLowerCase\(\) === flow\.fromAddress\.toLowerCase\(\)/);
  assert.match(dynamicFlowSource, /FLOW_ATTEMPT_STORAGE_KEY/);
  assert.match(dynamicFlowSource, /JSON\.stringify\(attempt\)/);
  assert.match(dynamicFlowSource, /A USDC approval may already exist/);
  assert.match(dynamicFlowSource, /backendRouteMatchesDemo/);
  assert.match(dynamicFlowSource, /canClearUnreadableAttempt/);
  assert.match(dynamicFlowSource, /\/v1\/flows\/verify/);
  assert.match(dynamicFlowSource, /JSON\.stringify\(\{[\s\S]*?flowId: activeFlowId,[\s\S]*?paymentIntentId,[\s\S]*?settlementDestination: normalizedSettlementDestination/);
  assert.match(dynamicFlowSource, /isValidVerifyFlowResponse/);
  assert.match(dynamicFlowSource, /setDestinationVerified\(true\)/);
  assert.doesNotMatch(dynamicFlowSource, /sessionToken/);
  assert.doesNotMatch(dynamicFlowSource, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(dynamicFlowSource, /flow\?\.toAddress/);
  assert.doesNotMatch(dynamicFlowSource, /flow\.destinationConfig|flow\?\.destinationConfig/);
  assert.doesNotMatch(dynamicFlowSource, /readFlowSettlementDestination|destinationMatchesFlow|destinationConflictsWithFlow/);
  assert.match(dynamicFlowSource, /flow\?\.settlement\?\.toAddress/);
  assert.match(dynamicFlowSource, /flow\.executionState === "source_attached" \|\| signingCanBeRequoted/);
  assert.doesNotMatch(dynamicFlowSource, /\["source_attached", "quoted"\]\.includes\(flow\.executionState\)/);
  assert.match(dynamicFlowSource, /async function attachAndScreen\(\)[\s\S]*?!payerDiffersFromDestination/);
  assert.match(dynamicFlowSource, /async function requestQuote\(\)[\s\S]*?!payerDiffersFromDestination[\s\S]*?!accessKey/);
  assert.match(dynamicFlowSource, /async function requestQuote\(\)[\s\S]*?await verifyDestination\(flowId\)/);
  assert.doesNotMatch(dynamicFlowSource, /const quotedDestination/);
  assert.match(dynamicFlowSource, /async function submitFlow\(\)[\s\S]*?!payerDiffersFromDestination[\s\S]*?!destinationVerified[\s\S]*?resolvedSettlementDestinationConflicts/);
});

test("the Flow create-and-verify worker is narrow and fixes all value-moving configuration", () => {
  assert.match(flowWorkerSource, /Authorization: `Bearer \$\{env\.DYNAMIC_API_TOKEN\}`/);
  assert.match(flowWorkerSource, /ONE_DEMO_ACCESS_KEY/);
  assert.doesNotMatch(flowWorkerSource, /MERCHANT_BASE_SEPOLIA_ADDRESS/);
  assert.match(flowWorkerSource, /FLOW_AMOUNT_USD/);
  assert.match(flowWorkerSource, /ZERO_ADDRESS/);
  assert.match(flowWorkerSource, /normalizeSettlementDestination/);
  assert.match(flowWorkerSource, /identifier: settlementDestination/);
  assert.match(flowWorkerSource, /tokenDecimals: 6/);
  assert.match(flowWorkerSource, /disableSwaps: true/);
  assert.match(flowWorkerSource, /pegStablecoins: true/);
  assert.match(flowWorkerSource, /Only paymentIntentId and settlementDestination are accepted/);
  assert.match(flowWorkerSource, /\/v1\/flows\/verify/);
  assert.match(flowWorkerSource, /flowConfigurationMatches/);
  assert.match(flowWorkerSource, /Only flowId, paymentIntentId and settlementDestination are accepted/);
  assert.match(flowWorkerSource, /return json\(\{ verified: true \}, 200, origin\)/);
  assert.doesNotMatch(flowWorkerSource, /body\.payerAddress|payerAddress,/);
  assert.doesNotMatch(flowWorkerSource, /dyn_[A-Za-z0-9_-]{8,}/);
});

test("the Controls deep link targets the Dynamic Flow harness", () => {
  assert.match(appSource, /document\.getElementById\(window\.location\.hash\.slice\(1\)\)/);
  assert.match(appSource, /target\.scrollIntoView/);
  assert.match(dynamicFlowSource, /id="dynamic-flow-demo"/);
});


test("account and wallet detail journeys remain present", () => {
  for (const label of [
    "Accounts & wallets",
    "View account details",
    "View wallet details",
    "Main stablecoin wallet",
    "Bitcoin wallet",
    "Solana wallet",
    "Copy demo address",
    "Fictional demo identifier",
  ]) {
    assert.match(appSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("all illustrated receiving identifiers are visibly non-actionable", () => {
  for (const identifier of [
    "DEMO-EUR-IBAN-2941",
    "DEMO-GBP-ACCOUNT-6110",
    "DEMO-USD-ACCOUNT-8842",
    "DEMO-POLYGON-USDC-7F21",
    "DEMO-BITCOIN-BTC-5B92",
    "DEMO-SOLANA-SOL-9A14",
  ]) {
    assert.match(appSource, new RegExp(identifier));
    assert.ok(identifier.startsWith("DEMO-"));
  }
});

test("no live-looking financial destinations are embedded", () => {
  for (const pattern of [
    /\b0x[a-fA-F0-9]{40}\b/,
    /\b(?:bc1[a-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/i,
    /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/,
  ]) {
    assert.doesNotMatch(appSource, pattern);
  }
});

test("public prototype does not include internal or actionable data", () => {
  for (const forbidden of [
    "Bryan Feng",
    "pay.one.io",
    "api.one.io",
    "BoomFi",
    "0x71f2d8c046b9a1c7e62c2aef4e41d93b8c1f91a4",
    "DE89 3704 0044 0532 0130 00",
    "4 of 6 defined",
    "Input by Day 10",
    "Input by Day 15",
    "Decide by Day 20",
  ]) {
    assert.doesNotMatch(appSource, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
