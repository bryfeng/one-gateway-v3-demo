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
    "Controls & evidence",
  ]) {
    assert.match(appSource, new RegExp(label));
  }
});

test("controls view separates custody evidence and requires explicit Base Sepolia wallet actions", () => {
  for (const label of [
    "Ownership and control matrix",
    "Payer wallet",
    "Optional deposit-address source",
    "External execution",
    "Merchant destination",
    "ONE policy / refusal boundary",
    "ONE-owned acceptance",
    "Merchant-owned acceptance",
    "Downstream ONE access",
    "Gateway services · screening required",
    "Self-custody checkout only",
    "a later tier change does not make an unscreened balance eligible",
    "No waiver of mandatory controls",
    "Refund control",
    "Original payment-intent linkage",
    "Test-demonstrated",
    "Dynamic-provided",
    "Legal decision",
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
    "eth_sendTransaction",
    "eth_getTransactionReceipt",
    "No auto-send",
    "Flow enabled · testnet run pending",
  ]) {
    assert.match(appSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(appSource, /84532/);
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
  assert.match(appSource, /scoped server token is deployed only as an encrypted, meeting-gated Worker secret/);
  assert.match(appSource, /Deployment alone did not create a Flow or execute a transaction/);
  assert.match(appSource, /Flow and Base Sepolia are enabled/);
});

test("Dynamic Flow test harness preserves the real risk and settlement boundaries", () => {
  for (const label of [
    "VITE_FLOW_API_BASE_URL",
    "FLOW_TESTNET_NETWORK_READY = true",
    "useAttachFlowSource",
    "useGetFlowQuote",
    "useSubmitFlowTransaction",
    "Dynamic Flow · 1.00 test USDC to a fixed merchant destination",
    "Attach + screen",
    "Get quote",
    "Review + submit",
    "Recover quote",
    "A blocked or review result stops this ONE Gateway attempt before funds move",
    "source_confirmed",
    "settlementState === \"completed\"",
    "Dynamic does not supply or own this wallet",
    "The wallet-source route does not inherently use a Flow-generated deposit address",
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
  assert.doesNotMatch(dynamicFlowSource, /sessionToken/);
  assert.doesNotMatch(dynamicFlowSource, /console\.(?:log|error|warn)/);
});

test("the Flow-create worker is narrow and fixes all value-moving configuration", () => {
  assert.match(flowWorkerSource, /Authorization: `Bearer \$\{env\.DYNAMIC_API_TOKEN\}`/);
  assert.match(flowWorkerSource, /ONE_DEMO_ACCESS_KEY/);
  assert.match(flowWorkerSource, /MERCHANT_BASE_SEPOLIA_ADDRESS/);
  assert.match(flowWorkerSource, /FLOW_AMOUNT_USD/);
  assert.match(flowWorkerSource, /ZERO_ADDRESS/);
  assert.match(flowWorkerSource, /tokenDecimals: 6/);
  assert.match(flowWorkerSource, /disableSwaps: true/);
  assert.match(flowWorkerSource, /pegStablecoins: true/);
  assert.match(flowWorkerSource, /Only paymentIntentId is accepted/);
  assert.doesNotMatch(flowWorkerSource, /body\.payerAddress|payerAddress,/);
  assert.doesNotMatch(flowWorkerSource, /dyn_[A-Za-z0-9_-]{8,}/);
});

test("the Controls deep link targets the Dynamic Flow harness", () => {
  assert.match(appSource, /document\.getElementById\(window\.location\.hash\.slice\(1\)\)/);
  assert.match(appSource, /target\.scrollIntoView/);
  assert.match(dynamicFlowSource, /id="dynamic-flow-demo"/);
});

test("testnet evidence is frozen and duplicate sends are guarded", () => {
  for (const label of [
    "SubmittedTestEvidence",
    "submittedTestEvidence",
    "displayedTestEvidence",
    "testRequestPending",
    "Boolean(testTransactionHash)",
    "Generate a new test intent before requesting another transfer.",
    "Frozen when the wallet transaction was requested",
    "no production payment, embedded wallet or banking rail is connected",
    "Two separately labelled Base Sepolia proof tracks",
  ]) {
    assert.match(appSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(appSource, /disabled=\{testRequestPending\}[^>]*>Generate new test intent/);

  const sendFunction = appSource.slice(
    appSource.indexOf("async function sendBaseSepoliaTransaction"),
    appSource.indexOf("function acceptCheckoutPayment"),
  );
  assert.ok(sendFunction.indexOf("setSubmittedTestEvidence({") < sendFunction.indexOf('method: "eth_sendTransaction"'));
  assert.match(sendFunction, /if \(testRequestPending\) return;/);
  assert.match(sendFunction, /if \(testTransactionHash\)/);

  const resetFunction = appSource.slice(
    appSource.indexOf("function generateNewTestIntent"),
    appSource.indexOf("async function sendBaseSepoliaTransaction"),
  );
  assert.match(resetFunction, /setSubmittedTestEvidence\(null\)/);
  assert.match(appSource, /const displayedTestEvidence = testTransactionHash\s*\? submittedTestEvidence\s*:/);
  assert.match(appSource, /<h3>\{displayedTestEvidence\?\.paymentIntentId/);
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
