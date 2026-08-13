"use client";

import { useEffect, useMemo, useState } from "react";

type View =
  | "overview"
  | "exchange"
  | "activation"
  | "accounts"
  | "payments"
  | "payouts"
  | "settlements"
  | "reporting"
  | "developer";
type Tone = "green" | "blue" | "amber" | "red" | "gray" | "purple";
type CustomerType = "iGaming operator" | "Prop firm" | "PSP";
type PaymentKind = "Payment link" | "Invoice" | "Hosted checkout" | "API payment";
type CheckoutMethod = "Wallet" | "Exchange" | "Deposit address";
type CheckoutStage = "choose" | "source" | "quote" | "instructions" | "processing" | "paid";
type AssetKind = "Fiat" | "Crypto";
type AccountKind = "Fiat account" | "Crypto wallet";
type RecipientKind = "Bank account" | "Crypto wallet";
type RecipientStatus = "Ready" | "Needs information" | "Pending verification";
type OneTimePayoutStage = "recipient" | "create-recipient" | "details" | "review" | "scheduled";

interface AssetOption {
  code: string;
  name: string;
  kind: AssetKind;
  balance: string;
  referenceUsd: number;
  decimals: number;
  networks?: string[];
}

interface WalletAddress {
  network: string;
  address: string;
  label: string;
}

interface MerchantAccountBase {
  id: string;
  code: string;
  name: string;
  kind: AccountKind;
  balance: string;
  meta: string;
  accent: string;
  status: string;
  statusTone: Tone;
}

interface FiatMerchantAccount extends MerchantAccountBase {
  kind: "Fiat account";
  accountHolder: string;
  country: string;
  rail: string;
  accountLabel: string;
  accountIdentifier: string;
  bankCodeLabel: string;
  bankCode: string;
  paymentReference: string;
}

interface CryptoMerchantAccount extends MerchantAccountBase {
  kind: "Crypto wallet";
  assetName: string;
  walletType: string;
  control: string;
  addresses: WalletAddress[];
  primary?: boolean;
}

type MerchantAccount = FiatMerchantAccount | CryptoMerchantAccount;

interface Recipient {
  id: string;
  name: string;
  kind: RecipientKind;
  assetCode: string;
  route: string;
  destination: string;
  fullDestination: string;
  status: RecipientStatus;
}

interface PaymentRow {
  reference: string;
  type: PaymentKind;
  customer: string;
  amount: string;
  settlement: string;
  settlementStatus: string;
  status: string;
  tone: Tone;
  stage: number;
  exception?: string;
}

interface SettlementRow {
  reference: string;
  label: string;
  source: string;
  route: string;
  amount: string;
  destination: string;
  status: string;
  tone: Tone;
  matched: string;
  step: number;
}

const assetCatalog: AssetOption[] = [
  { code: "EUR", name: "Euro", kind: "Fiat", balance: "€642,850.40", referenceUsd: 1.09, decimals: 2 },
  { code: "GBP", name: "Pound sterling", kind: "Fiat", balance: "£88,420.15", referenceUsd: 1.28, decimals: 2 },
  { code: "USD", name: "US dollar", kind: "Fiat", balance: "$312,480.00", referenceUsd: 1, decimals: 2 },
  { code: "CHF", name: "Swiss franc", kind: "Fiat", balance: "CHF 54,920.00", referenceUsd: 1.13, decimals: 2 },
  { code: "SEK", name: "Swedish krona", kind: "Fiat", balance: "SEK 418,600.00", referenceUsd: 0.095, decimals: 2 },
  { code: "NOK", name: "Norwegian krone", kind: "Fiat", balance: "NOK 205,400.00", referenceUsd: 0.093, decimals: 2 },
  { code: "DKK", name: "Danish krone", kind: "Fiat", balance: "DKK 162,850.00", referenceUsd: 0.146, decimals: 2 },
  { code: "PLN", name: "Polish złoty", kind: "Fiat", balance: "PLN 98,400.00", referenceUsd: 0.255, decimals: 2 },
  { code: "USDC", name: "USD Coin", kind: "Crypto", balance: "84,620.00 USDC", referenceUsd: 1, decimals: 2, networks: ["Polygon", "Ethereum", "Solana"] },
  { code: "USDT", name: "Tether", kind: "Crypto", balance: "42,180.00 USDT", referenceUsd: 1, decimals: 2, networks: ["TRON", "Ethereum", "Polygon"] },
  { code: "BTC", name: "Bitcoin", kind: "Crypto", balance: "1.84250000 BTC", referenceUsd: 65000, decimals: 8, networks: ["Bitcoin"] },
  { code: "ETH", name: "Ether", kind: "Crypto", balance: "28.450000 ETH", referenceUsd: 3500, decimals: 6, networks: ["Ethereum"] },
  { code: "SOL", name: "Solana", kind: "Crypto", balance: "640.2500 SOL", referenceUsd: 150, decimals: 4, networks: ["Solana"] },
];

const merchantAccounts: MerchantAccount[] = [
  {
    id: "account-eur",
    code: "EUR",
    name: "Euro account",
    kind: "Fiat account",
    balance: "€642,850.40",
    meta: "SEPA · Germany",
    accent: "#315adf",
    status: "Account active",
    statusTone: "green",
    accountHolder: "Northstar Gaming Europe",
    country: "Germany",
    rail: "SEPA",
    accountLabel: "IBAN",
    accountIdentifier: "DEMO-EUR-IBAN-2941",
    bankCodeLabel: "BIC / SWIFT",
    bankCode: "DEMO-EUR-BIC",
    paymentReference: "DEMO-NORTHSTAR-EUR",
  },
  {
    id: "account-gbp",
    code: "GBP",
    name: "Sterling account",
    kind: "Fiat account",
    balance: "£88,420.15",
    meta: "Faster Payments · United Kingdom",
    accent: "#6f47c5",
    status: "Account active",
    statusTone: "green",
    accountHolder: "Northstar Gaming Europe",
    country: "United Kingdom",
    rail: "Faster Payments",
    accountLabel: "Account number",
    accountIdentifier: "DEMO-GBP-ACCOUNT-6110",
    bankCodeLabel: "Sort code",
    bankCode: "DEMO-SORT-20-00-00",
    paymentReference: "DEMO-NORTHSTAR-GBP",
  },
  {
    id: "account-usd",
    code: "USD",
    name: "Dollar account",
    kind: "Fiat account",
    balance: "$312,480.00",
    meta: "ACH / wire · United States",
    accent: "#176f4b",
    status: "Account active",
    statusTone: "green",
    accountHolder: "Northstar Gaming Europe",
    country: "United States",
    rail: "ACH / wire",
    accountLabel: "Account number",
    accountIdentifier: "DEMO-USD-ACCOUNT-8842",
    bankCodeLabel: "Routing number",
    bankCode: "DEMO-ROUTING-021000",
    paymentReference: "DEMO-NORTHSTAR-USD",
  },
  {
    id: "wallet-usdc",
    code: "USDC",
    name: "Smart Account",
    kind: "Crypto wallet",
    balance: "84,620.00 USDC",
    meta: "Main stablecoin wallet · Polygon",
    accent: "#1b9b73",
    status: "Primary wallet",
    statusTone: "green",
    assetName: "USD Coin",
    walletType: "Merchant smart account",
    control: "Merchant policy and signing controls",
    primary: true,
    addresses: [
      { network: "Polygon", address: "DEMO-POLYGON-USDC-7F21", label: "Primary receiving address" },
      { network: "Ethereum", address: "DEMO-ETHEREUM-USDC-4C18", label: "Ethereum receiving address" },
      { network: "Solana", address: "DEMO-SOLANA-USDC-2D73", label: "Solana receiving address" },
    ],
  },
  {
    id: "wallet-btc",
    code: "BTC",
    name: "Bitcoin wallet",
    kind: "Crypto wallet",
    balance: "1.84250000 BTC",
    meta: "Bitcoin network · native address",
    accent: "#d88718",
    status: "Wallet ready",
    statusTone: "blue",
    assetName: "Bitcoin",
    walletType: "Merchant asset wallet",
    control: "Approved wallet policy",
    addresses: [{ network: "Bitcoin", address: "DEMO-BITCOIN-BTC-5B92", label: "Bitcoin receiving address" }],
  },
  {
    id: "wallet-sol",
    code: "SOL",
    name: "Solana wallet",
    kind: "Crypto wallet",
    balance: "640.2500 SOL",
    meta: "Solana network · native address",
    accent: "#5b4fc5",
    status: "Wallet ready",
    statusTone: "blue",
    assetName: "Solana",
    walletType: "Merchant asset wallet",
    control: "Approved wallet policy",
    addresses: [{ network: "Solana", address: "DEMO-SOLANA-SOL-9A14", label: "Solana receiving address" }],
  },
];

const fiatMerchantAccounts = merchantAccounts.filter((account): account is FiatMerchantAccount => account.kind === "Fiat account");
const cryptoMerchantAccounts = merchantAccounts.filter((account): account is CryptoMerchantAccount => account.kind === "Crypto wallet");

const initialRecipients: Recipient[] = [
  { id: "recipient-player-1042", name: "Demo Player 1042", kind: "Bank account", assetCode: "EUR", route: "SEPA · Germany", destination: "DEMO…1042", fullDestination: "DEMO-BANK-EUR-1042", status: "Ready" },
  { id: "recipient-player-2088", name: "Demo Player 2088", kind: "Crypto wallet", assetCode: "USDC", route: "Polygon · External wallet", destination: "DEMO…2088", fullDestination: "DEMO-WALLET-USDC-2088", status: "Ready" },
  { id: "recipient-player-3091", name: "Demo Player 3091", kind: "Bank account", assetCode: "GBP", route: "Faster Payments · United Kingdom", destination: "DEMO…3091", fullDestination: "DEMO-BANK-GBP-3091", status: "Needs information" },
];

const fiatAssets = assetCatalog.filter((asset) => asset.kind === "Fiat");
const cryptoAssets = assetCatalog.filter((asset) => asset.kind === "Crypto");

const checkoutMethods: Array<{ method: CheckoutMethod; mark: string; title: string; detail: string }> = [
  { method: "Wallet", mark: "W", title: "Wallet", detail: "MetaMask, Phantom, Coinbase Wallet and more" },
  { method: "Exchange", mark: "E", title: "Exchange", detail: "Pay from a supported exchange balance" },
  { method: "Deposit address", mark: "Q", title: "Deposit address", detail: "Send from anywhere—no connection needed" },
];

const checkoutQuoteAmounts: Record<string, string> = {
  USDC: "10,927.33",
  USDT: "10,928.10",
  BTC: "0.16811234",
  ETH: "3.122600",
  SOL: "72.8650",
};

function getAsset(code: string) {
  return assetCatalog.find((asset) => asset.code === code) ?? assetCatalog[0];
}

function parseAssetAmount(value: string) {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}

function formatAssetAmount(value: number, asset: AssetOption) {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: asset.decimals, maximumFractionDigits: asset.decimals })} ${asset.code}`;
}

async function writeClipboard(value: string) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy path used by restricted preview browsers.
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  return copied;
}

function AssetOptions() {
  return (
    <>
      <optgroup label="Fiat currencies">{fiatAssets.map((asset) => <option key={asset.code} value={asset.code}>{asset.code} · {asset.name}</option>)}</optgroup>
      <optgroup label="Crypto assets">{cryptoAssets.map((asset) => <option key={asset.code} value={asset.code}>{asset.code} · {asset.name}</option>)}</optgroup>
    </>
  );
}

function statusTone(status: RecipientStatus): Tone {
  if (status === "Ready") return "green";
  if (status === "Needs information") return "amber";
  return "blue";
}

const navGroups: Array<{ label: string; items: Array<{ id: View; label: string; mark: string }> }> = [
  {
    label: "Money movement",
    items: [
      { id: "overview", label: "Overview", mark: "O" },
      { id: "exchange", label: "Exchange", mark: "X" },
      { id: "payments", label: "Payments", mark: "P" },
      { id: "payouts", label: "Payouts", mark: "B" },
      { id: "settlements", label: "Settlements", mark: "S" },
    ],
  },
  {
    label: "Configure",
    items: [{ id: "reporting", label: "Reporting", mark: "R" }],
  },
  {
    label: "Build",
    items: [{ id: "developer", label: "Developer", mark: "D" }],
  },
];

const viewTitles: Record<View, string> = {
  overview: "Overview",
  exchange: "Exchange",
  activation: "Activation",
  accounts: "Accounts & wallets",
  payments: "Payments",
  payouts: "Payouts",
  settlements: "Settlements",
  reporting: "Reporting",
  developer: "Developer",
};

const initialPayments: PaymentRow[] = [
  {
    reference: "INV-2048",
    type: "Payment link",
    customer: "Demo Player 1042",
    amount: "£12,400.00",
    settlement: "GBP account",
    settlementStatus: "Scheduled · 16:00 CET",
    status: "Paid",
    tone: "green",
    stage: 3,
  },
  {
    reference: "PAY-8F21",
    type: "API payment",
    customer: "Demo Player 2088",
    amount: "$18,920.00",
    settlement: "USD account",
    settlementStatus: "Not started",
    status: "Processing",
    tone: "blue",
    stage: 2,
  },
  {
    reference: "INV-2046",
    type: "Invoice",
    customer: "Coastline Media OÜ",
    amount: "€8,750.00",
    settlement: "EUR account",
    settlementStatus: "Not started",
    status: "Processing",
    tone: "blue",
    stage: 2,
  },
  {
    reference: "PAY-8F19",
    type: "Hosted checkout",
    customer: "Atlas Systems GmbH",
    amount: "€21,500.00",
    settlement: "EUR account",
    settlementStatus: "Paused",
    status: "Needs attention",
    tone: "amber",
    stage: 3,
    exception: "Verification needed: sender name does not match the payer details.",
  },
  {
    reference: "INV-2043",
    type: "Payment link",
    customer: "Nordholm Services AB",
    amount: "$6,240.00",
    settlement: "USDC smart account",
    settlementStatus: "Not started",
    status: "Awaiting payment",
    tone: "blue",
    stage: 1,
  },
];

const exchangeRows = [
  { reference: "EXC-1108", pair: "USD → USDC", sold: "25,000.00 USD", bought: "24,937.50 USDC", type: "Fiat → Crypto", status: "Completed", tone: "green" as Tone },
  { reference: "EXC-1107", pair: "USDC → EUR", sold: "52,000.00 USDC", bought: "€47,660.55", type: "Crypto → Fiat", status: "Completed", tone: "green" as Tone },
  { reference: "EXC-1106", pair: "GBP → EUR", sold: "£18,400.00", bought: "€21,610.30", type: "Fiat → Fiat", status: "Completed", tone: "green" as Tone },
  { reference: "EXC-1105", pair: "ETH → BTC", sold: "4.500000 ETH", bought: "0.24190000 BTC", type: "Crypto → Crypto", status: "Processing", tone: "blue" as Tone },
];

const payoutActivityRows = [
  {
    reference: "OUT-4027",
    name: "Demo Player 1042",
    type: "One-time payout",
    route: "USDC → EUR",
    count: "1 recipient",
    amount: "€25,000.00",
    status: "Scheduled",
    tone: "blue" as Tone,
    detail: "SEPA beneficiary validated",
  },
  {
    reference: "OUT-4026",
    name: "Demo Player 2088",
    type: "One-time payout",
    route: "USDC smart account",
    count: "1 recipient",
    amount: "8,500.00 USDC",
    status: "Completed",
    tone: "green" as Tone,
    detail: "Paid · evidence matched",
  },
  {
    reference: "BAT-0183",
    name: "Friday player withdrawals",
    type: "Batch payout",
    route: "USD → USDC",
    count: "42 recipients",
    amount: "$164,300.00",
    status: "Partially completed",
    tone: "amber" as Tone,
    detail: "38 paid · 3 sending · 1 held",
  },
  {
    reference: "BAT-0182",
    name: "Affiliate payouts · August",
    type: "Batch payout",
    route: "USDC smart account",
    count: "118 recipients",
    amount: "94,750.00 USDC",
    status: "Completed",
    tone: "green" as Tone,
    detail: "118 paid",
  },
  {
    reference: "BAT-0181",
    name: "Priority withdrawals",
    type: "Batch payout",
    route: "EUR → USDC",
    count: "16 recipients",
    amount: "€73,820.00",
    status: "Approval required",
    tone: "amber" as Tone,
    detail: "2 approvals required",
  },
  {
    reference: "BAT-0180",
    name: "Partner settlement",
    type: "Batch payout",
    route: "USDC → GBP",
    count: "8 recipients",
    amount: "£28,400.00",
    status: "Funding required",
    tone: "amber" as Tone,
    detail: "8 bank destinations ready",
  },
];

const settlementRows: SettlementRow[] = [
  {
    reference: "SET-1048",
    label: "First merchant settlement",
    source: "17 accepted payments",
    route: "USDC → EUR",
    amount: "€54,290.40",
    destination: "EUR operating · •• 2941",
    status: "Settled",
    tone: "green",
    matched: "17 of 17 matched",
    step: 4,
  },
  {
    reference: "SET-1051",
    label: "Daily EUR settlement",
    source: "12 accepted payments",
    route: "USDC → EUR",
    amount: "€38,840.00",
    destination: "EUR operating · •• 2941",
    status: "Scheduled",
    tone: "blue",
    matched: "12 of 12 ready",
    step: 0,
  },
  {
    reference: "SET-1050",
    label: "Stablecoin settlement",
    source: "8 accepted payments",
    route: "USDC → USDC",
    amount: "28,400.00 USDC",
    destination: "USDC smart account",
    status: "Processing",
    tone: "blue",
    matched: "8 of 8 matched",
    step: 2,
  },
  {
    reference: "SET-1049",
    label: "GBP operating settlement",
    source: "5 accepted payments",
    route: "USDC → GBP",
    amount: "£19,620.00",
    destination: "GBP operating · •• 6110",
    status: "Action required",
    tone: "amber",
    matched: "4 matched · 1 exception",
    step: 2,
  },
];

const activationSteps = [
  { title: "Workspace invitation", owner: "ONE", due: "Start", status: "Complete", tone: "green" as Tone, detail: "Merchant admin and primary operating region recorded." },
  { title: "Entity & service perimeter", owner: "ONE Legal", due: "Pre-build input", status: "Decision required", tone: "amber" as Tone, detail: "ONE selects the contracting entity, eligible markets and service perimeter." },
  { title: "KYB information pack", owner: "Merchant + ONE Compliance", due: "Pre-build input", status: "Under review", tone: "blue" as Tone, detail: "Company, ownership, activity, expected volumes and required evidence exchanged." },
  { title: "Settlement & control profile", owner: "Merchant + V3", due: "Design decision", status: "Configured", tone: "green" as Tone, detail: "Assets, chains, destination, limits, approvals and fiat/stablecoin preference." },
  { title: "Technical & service terms", owner: "ONE Legal + V3", due: "Pre-build input", status: "Input required", tone: "amber" as Tone, detail: "ONE owns substance; V3 defines where terms, disclosures and acceptance appear." },
  { title: "Sandbox acceptance", owner: "Merchant + V3", due: "Day 60 target", status: "Planned", tone: "gray" as Tone, detail: "Checkout, lifecycle, exceptions, settlement and exports tested against approved routes." },
  { title: "Live activation", owner: "ONE", due: "Day 90 timetable", status: "Not started", tone: "gray" as Tone, detail: "Compliance, banking, technical and commercial approvals complete before production access." },
];

const developerEvents = [
  ["payment.processing", "PAY-8F21", "Delivered", "Sample · 4 sec ago"],
  ["payment.paid", "INV-2048", "Delivered", "Sample · 2 min ago"],
  ["payout.item_held", "BAT-0183-042", "Delivered", "Sample · 6 min ago"],
  ["settlement.settled", "SET-1048", "Delivered", "Sample · 18 min ago"],
  ["payment.needs_attention", "PAY-8F19", "Delivered", "Sample · 24 min ago"],
];

const customerPhaseMatrix: Record<CustomerType, Array<{ phase: string; tone: Tone; title: string; items: string[] }>> = {
  "iGaming operator": [
    { phase: "Day 30", tone: "blue", title: "Decide the launch product", items: ["Checkout, payment-link and settlement journey agreed", "Assets, chains, controls and completion event decided", "Batch crypto payouts accepted or rejected as a Day 60 candidate"] },
    { phase: "Day 60", tone: "green", title: "Sell the approved sandbox MVP", items: ["Hosted checkout, links/API and merchant status lifecycle", "Controlled stablecoin and approved optional fiat settlement", "Batch withdrawals only if accepted at the Day 30 gate"] },
    { phase: "Day 90", tone: "purple", title: "Pilot and production timetable", items: ["Pilot evidence, controls, tests and operating runbook", "Merchant collateral and ONE-owned handoff", "Production plan against approved jurisdictions and routes"] },
    { phase: "After", tone: "gray", title: "Expand the operating surface", items: ["Additional assets, chains and gaming cash-out cases", "Broader affiliate and treasury automation", "Production rollout follows the approved timetable"] },
  ],
  "Prop firm": [
    { phase: "Day 30", tone: "blue", title: "Decide deposits and withdrawals", items: ["Persistent branded URL versus per-execution address model", "Fiat-funded and crypto-funded withdrawal controls", "Settlement and reconciliation lifecycle agreed"] },
    { phase: "Day 60", tone: "green", title: "Sell the approved sandbox MVP", items: ["Payment link, invoice/API funding and balance visibility", "Stablecoin or approved optional fiat settlement", "CSV crypto withdrawals if promoted into MVP at Day 30"] },
    { phase: "Day 90", tone: "purple", title: "Pilot and production timetable", items: ["End-to-end deposit and withdrawal pilot evidence", "Exception, approval and reconciliation runbook", "Production backlog and ONE-owned handoff"] },
    { phase: "After", tone: "gray", title: "Expand treasury controls", items: ["More payout networks and recipient policies", "Automated treasury allocation and exposure views", "Additional regions and operating entities"] },
  ],
  PSP: [
    { phase: "Day 30", tone: "blue", title: "Decide the platform contract", items: ["Payment intent, API and normalized event model", "Merchant eligibility and settlement-profile boundary", "Control ownership and completion evidence agreed"] },
    { phase: "Day 60", tone: "green", title: "Sell the approved sandbox MVP", items: ["Approved payment API, hosted checkout and webhooks", "Merchant references, balances and reconciliation exports", "Only supported routes and approved settlement modes"] },
    { phase: "Day 90", tone: "purple", title: "Pilot and production timetable", items: ["Partner pilot, tests, controls and service runbook", "Technical collateral and integration handoff", "Production timetable with ownership and support model"] },
    { phase: "After", tone: "gray", title: "Expand embedded distribution", items: ["Deeper merchant onboarding automation", "Additional route coverage and reporting depth", "Broader account and TMS capabilities"] },
  ],
};

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`status status-${tone}`}>{label}</span>;
}

function NavButton({ label, mark, active, onClick }: { label: string; mark: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? "nav-item-active" : ""}`} onClick={onClick} type="button">
      <span className="nav-mark" aria-hidden="true">{mark}</span>
      <span>{label}</span>
    </button>
  );
}

function BalanceCard({ account, onView }: { account: MerchantAccount; onView: () => void }) {
  const smart = account.kind === "Crypto wallet" && account.primary;
  return (
    <article className={`balance-card ${smart ? "balance-card-smart" : ""}`}>
      <div className="balance-card-top">
        <span className="currency-mark" style={{ background: account.accent }}>{account.code.slice(0, 1)}</span>
        <div><p>{account.name}</p><span>{account.code} · {account.kind}</span></div>
        {smart ? <StatusBadge label="Primary" tone="green" /> : null}
      </div>
      <strong>{account.balance}</strong>
      <small>{account.meta}</small>
      <button className="account-card-action" onClick={onView} type="button">{account.kind === "Fiat account" ? "View account details" : "View wallet details"}</button>
    </article>
  );
}

function AccountDetailModal({ account, selectedNetwork, onNetworkChange, onClose, onCopy }: {
  account: MerchantAccount;
  selectedNetwork: string;
  onNetworkChange: (network: string) => void;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
}) {
  const walletAddress = account.kind === "Crypto wallet"
    ? account.addresses.find((item) => item.network === selectedNetwork) ?? account.addresses[0]
    : null;
  const detailTitle = account.kind === "Crypto wallet" && account.primary ? "Main stablecoin wallet" : account.name;

  return (
    <div className="modal-backdrop">
      <section className="modal account-detail-modal" role="dialog" aria-modal="true" aria-labelledby="account-detail-title">
        <button className="modal-close" aria-label="Close" onClick={onClose} type="button">×</button>
        <p className="eyebrow">{account.kind} · target interface</p>
        <div className="account-detail-heading">
          <span className="account-detail-mark" style={{ background: account.accent }}>{account.code.slice(0, 1)}</span>
          <div><h2 id="account-detail-title">{detailTitle}</h2><p>{account.kind === "Crypto wallet" ? `${account.code} · ${walletAddress?.network}` : `${account.code} · ${account.meta}`}</p></div>
          <StatusBadge label={account.status} tone={account.statusTone} />
        </div>

        <div className="demo-account-boundary">
          <strong>Mock account data · do not send funds</strong>
          <p>These identifiers are intentionally invalid. No bank account, wallet, private key, signing capability or custody arrangement exists behind this interface.</p>
        </div>

        <div className="account-balance-summary"><span>Illustrative balance</span><strong>{account.balance}</strong><small>Balance visibility is separate from the receiving instructions below.</small></div>

        {account.kind === "Fiat account" ? (
          <div className="account-detail-body">
            <div className="account-detail-grid">
              <div><span>Account holder</span><strong>{account.accountHolder}</strong></div>
              <div><span>Country and rail</span><strong>{account.country} · {account.rail}</strong></div>
            </div>
            <div className="copyable-account-field">
              <div><span>{account.accountLabel}</span><code>{account.accountIdentifier}</code><small>Fictional demo identifier</small></div>
              <button className="button button-secondary" onClick={() => onCopy(account.accountIdentifier, `Demo ${account.accountLabel}`)} type="button">Copy demo {account.accountLabel}</button>
            </div>
            <div className="copyable-account-field">
              <div><span>{account.bankCodeLabel}</span><code>{account.bankCode}</code><small>Fictional demo identifier</small></div>
              <button className="button button-secondary" onClick={() => onCopy(account.bankCode, `Demo ${account.bankCodeLabel}`)} type="button">Copy demo bank code</button>
            </div>
            <div className="copyable-account-field">
              <div><span>Payment reference</span><code>{account.paymentReference}</code><small>Use to illustrate automated matching</small></div>
              <button className="button button-secondary" onClick={() => onCopy(account.paymentReference, "Demo reference")} type="button">Copy demo reference</button>
            </div>
          </div>
        ) : (
          <div className="account-detail-body">
            {account.addresses.length > 1 ? (
              <div className="wallet-network-selector" role="tablist" aria-label="Wallet network">
                {account.addresses.map((item) => <button aria-selected={selectedNetwork === item.network} className={selectedNetwork === item.network ? "selected" : ""} key={item.network} onClick={() => onNetworkChange(item.network)} role="tab" type="button">{item.network}</button>)}
              </div>
            ) : null}
            <div className="wallet-address-card">
              <div className="wallet-address-heading"><div><span>{walletAddress?.label}</span><strong>{account.code} · {walletAddress?.network}</strong></div><StatusBadge label="Receiving address" tone="blue" /></div>
              <code>{walletAddress?.address}</code>
              <button className="button button-primary" onClick={() => walletAddress && onCopy(walletAddress.address, "Demo address")} type="button">Copy demo address</button>
              <small>This demo address is intentionally invalid on {walletAddress?.network}. Never send funds to it.</small>
            </div>
            <div className="account-detail-grid account-detail-grid-three">
              <div><span>Asset</span><strong>{account.assetName} ({account.code})</strong></div>
              <div><span>Wallet type</span><strong>{account.walletType}</strong></div>
              <div><span>Control model</span><strong>{account.control}</strong></div>
            </div>
            <div className="wallet-network-warning"><strong>Asset and network stay together</strong><p>A {account.code} address on {walletAddress?.network} is a different receiving instruction from any other asset or network. The target product always shows all three together.</p></div>
          </div>
        )}
      </section>
    </div>
  );
}

function PageHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">Gateway V3 · Day 30 target experience</p><h1>{title}</h1><p>{description}</p></div>
      {children ? <div className="page-actions">{children}</div> : null}
    </div>
  );
}

function FlowNode({ title, owner, detail, tone = "gray" }: { title: string; owner: string; detail: string; tone?: Tone }) {
  return (
    <div className={`funds-node funds-node-${tone}`}>
      <span>{owner}</span>
      <strong>{title}</strong>
      <small>{detail}</small>
    </div>
  );
}

function PaymentLinkCheckout({ onClose, onPaymentAccepted }: { onClose: () => void; onPaymentAccepted: () => void }) {
  const [stage, setStage] = useState<CheckoutStage>("choose");
  const [method, setMethod] = useState<CheckoutMethod>("Wallet");
  const [assetCode, setAssetCode] = useState("USDC");
  const [network, setNetwork] = useState("Polygon");
  const [source, setSource] = useState("MetaMask");
  const [copied, setCopied] = useState(false);
  const asset = getAsset(assetCode);
  const quoteAmount = checkoutQuoteAmounts[assetCode] ?? "10,927.33";
  const sourceOptions = method === "Wallet"
    ? ["MetaMask", "Phantom", "Coinbase Wallet"]
    : method === "Exchange"
      ? ["Coinbase", "Kraken", "Binance"]
      : [];
  const progressIndex = stage === "choose" || stage === "source" ? 0 : stage === "quote" ? 1 : stage === "instructions" ? 2 : 3;
  const checkoutStatus = stage === "paid" ? "Paid" : stage === "processing" ? "Processing" : "Awaiting payment";
  const checkoutStatusTone: Tone = stage === "paid" ? "green" : "blue";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [stage]);

  function selectMethod(nextMethod: CheckoutMethod) {
    setMethod(nextMethod);
    setSource(nextMethod === "Wallet" ? "MetaMask" : nextMethod === "Exchange" ? "Coinbase" : "One-time address");
    setCopied(false);
    setStage("source");
  }

  function selectAsset(nextCode: string) {
    const nextAsset = getAsset(nextCode);
    setAssetCode(nextCode);
    setNetwork(nextAsset.networks?.[0] ?? "Native network");
  }

  function copyCheckoutAddress() {
    setCopied(true);
  }

  function restartCheckout() {
    setStage("choose");
    setMethod("Wallet");
    setAssetCode("USDC");
    setNetwork("Polygon");
    setSource("MetaMask");
    setCopied(false);
  }

  return (
    <div className="payer-checkout-shell">
      <header className="payer-checkout-header">
        <div className="payer-checkout-brand"><span className="brand-symbol">1</span><strong>ONE</strong><span>Checkout</span></div>
        <div className="payer-checkout-address"><span className="checkout-lock">●</span><span>checkout.demo.invalid/northstar/LNK-2051</span></div>
        <button className="button button-secondary" onClick={onClose} type="button">Close preview</button>
      </header>

      <div className="payer-prototype-strip"><strong>Target checkout · illustrative</strong><span>No live funds move in this preview.</span></div>

      <main className="payer-checkout-frame">
        <section className="payer-checkout-card">
          <div className="payer-progress" aria-label="Payment progress">
            {["Method", "Quote", "Send", "Status"].map((label, index) => <div className={index < progressIndex ? "complete" : index === progressIndex ? "active" : ""} key={label}><span>{index < progressIndex ? "✓" : index + 1}</span><small>{label}</small></div>)}
          </div>

          {stage === "choose" ? (
            <div className="payer-stage">
              <p className="eyebrow">Secure crypto payment</p>
              <h1>Choose how to pay</h1>
              <p className="payer-stage-lead">Pay from a wallet, exchange account, or one-time deposit address. You will review the exact asset, network and quote before anything is sent.</p>
              <div className="payer-inline-order"><span>Pay Northstar Gaming</span><strong>€10,000.00</strong></div>
              <div className="payer-method-list" role="group" aria-label="Payment method">
                {checkoutMethods.map((option) => <button key={option.method} onClick={() => selectMethod(option.method)} type="button"><span className="payer-method-mark">{option.mark}</span><span><strong>{option.title}</strong><small>{option.detail}</small></span><b>→</b></button>)}
              </div>
              <div className="payer-trust-note"><span>✓</span><p><strong>You stay in control.</strong> A transfer is only submitted after you approve it in your wallet or sending account.</p></div>
            </div>
          ) : null}

          {stage === "source" ? (
            <div className="payer-stage">
              <button className="payer-back" onClick={() => setStage("choose")} type="button">← Payment methods</button>
              <p className="eyebrow">{method}</p>
              <h1>{method === "Wallet" ? "Choose a wallet" : method === "Exchange" ? "Choose an exchange" : "Choose what you’ll send"}</h1>
              <p className="payer-stage-lead">{method === "Deposit address" ? "We’ll generate a fresh address for this payment attempt. No wallet connection or sign-in is required." : `This preview simulates the ${method.toLowerCase()} handoff. It does not connect to a real account.`}</p>
              {sourceOptions.length ? <div className="payer-source-grid" role="group" aria-label={`${method} source`}>{sourceOptions.map((option) => <button aria-pressed={source === option} className={source === option ? "selected" : ""} key={option} onClick={() => setSource(option)} type="button"><span>{option.slice(0, 1)}</span><strong>{option}</strong><small>{method === "Wallet" ? (option === "Phantom" ? "Solana · EVM" : "EVM") : "Exchange balance"}</small></button>)}</div> : null}
              <div className="payer-source-fields">
                <label>Pay with<select value={assetCode} onChange={(event) => selectAsset(event.target.value)}>{cryptoAssets.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.name}</option>)}</select></label>
                <label>Network<select value={network} onChange={(event) => setNetwork(event.target.value)}>{asset.networks?.map((option) => <option key={option}>{option}</option>)}</select></label>
              </div>
              <div className="payer-source-summary"><span className="payer-method-mark">{method.slice(0, 1)}</span><div><small>Selected source</small><strong>{source} · {assetCode} on {network}</strong></div><StatusBadge label="Illustrative" tone="blue" /></div>
              <button className="button button-primary button-full payer-main-action" onClick={() => setStage("quote")} type="button">Get payment quote</button>
            </div>
          ) : null}

          {stage === "quote" ? (
            <div className="payer-stage">
              <button className="payer-back" onClick={() => setStage("source")} type="button">← Change source</button>
              <div className="payer-quote-heading"><div><p className="eyebrow">Indicative quote</p><h1>Review your payment</h1></div><div className="payer-quote-timer"><small>Refreshes in</small><strong>00:60</strong></div></div>
              <div className="payer-amount-quote"><span>You send</span><strong>{quoteAmount} {assetCode}</strong><small>{source} · {network}</small></div>
              <dl className="payer-quote-details">
                <div><dt>Payment value</dt><dd>€10,000.00</dd></div>
                <div><dt>Indicative conversion</dt><dd>1 EUR = {assetCode === "USDC" ? "1.0927" : assetCode === "USDT" ? "1.0928" : "live rate"} {assetCode}</dd></div>
                <div><dt>Route and service fee</dt><dd>Included in amount above</dd></div>
                <div><dt>Estimated network fee</dt><dd>Shown by {method === "Wallet" ? source : "sending account"}</dd></div>
              </dl>
              <div className="payer-conversion-note"><span>↔</span><p>Asset conversion and cross-chain routing may be executed by independent providers. Rates and fees can change until you approve the transfer.</p></div>
              <button className="button button-primary button-full payer-main-action" onClick={() => setStage("instructions")} type="button">Continue to payment</button>
            </div>
          ) : null}

          {stage === "instructions" ? (
            <div className="payer-stage">
              <button className="payer-back" onClick={() => setStage("quote")} type="button">← Back to quote</button>
              <p className="eyebrow">{method} · {assetCode} on {network}</p>
              <h1>{method === "Wallet" ? `Approve in ${source}` : method === "Exchange" ? `Send from ${source}` : "Send to this address"}</h1>
              <p className="payer-stage-lead">Send exactly <strong>{quoteAmount} {assetCode}</strong> on <strong>{network}</strong>. This route belongs only to this payment attempt.</p>
              <div className={`payer-send-layout ${method === "Wallet" ? "payer-send-layout-wallet" : ""}`}>
                {method === "Wallet" ? <div className="payer-wallet-approval"><span>{source.slice(0, 1)}</span><strong>{source} is ready</strong><small>Review the destination, asset and network in your wallet before signing.</small></div> : <div className="checkout-qr" role="img" aria-label="Illustrative deposit QR code"><span>ONE</span></div>}
                <div className="payer-address-panel">
                  <span>One-time {network} address</span>
                  <code>DEMO-WALLET-{assetCode}-{network.toUpperCase().replaceAll(" ", "-")}</code>
                  <button className="button button-secondary" onClick={copyCheckoutAddress} type="button">{copied ? "Demo address only" : "Inspect demo address"}</button>
                </div>
              </div>
              <dl className="payer-quote-details payer-instructions-detail"><div><dt>Exact amount</dt><dd>{quoteAmount} {assetCode}</dd></div><div><dt>Network</dt><dd>{network}</dd></div><div><dt>Address expires</dt><dd>48 hours</dd></div></dl>
              <div className="payer-network-warning"><strong>Only send {assetCode} on {network}.</strong><span>Using another asset or network can permanently lose funds. On-chain transfers cannot be reversed.</span></div>
              <button className="button button-primary button-full payer-main-action" onClick={() => setStage("processing")} type="button">{method === "Wallet" ? "Simulate wallet approval" : method === "Exchange" ? "Simulate exchange transfer" : "I’ve sent the payment"}</button>
            </div>
          ) : null}

          {stage === "processing" ? (
            <div className="payer-stage payer-status-stage">
              <div className="payer-processing-mark"><span /></div>
              <p className="eyebrow">Payment detected</p>
              <h1>We’re confirming your payment</h1>
              <p className="payer-stage-lead">We detected {quoteAmount} {assetCode} on {network}. You can safely leave this page and return with the same payment link.</p>
              <ol className="payer-status-list"><li className="complete"><span>✓</span><div><strong>Transfer submitted</strong><small>{source} · transaction observed</small></div></li><li className="active"><span>2</span><div><strong>Source confirming</strong><small>Network evidence and screening are in progress</small></div></li><li><span>3</span><div><strong>Payment accepted</strong><small>Not yet complete</small></div></li><li><span>4</span><div><strong>Merchant settlement</strong><small>Tracked separately after payment acceptance</small></div></li></ol>
              <button className="button button-secondary button-full payer-main-action" onClick={() => setStage("paid")} type="button">Simulate confirmations</button>
              <small className="payer-simulation-note">In production this screen advances from network and provider evidence—not from a customer button.</small>
            </div>
          ) : null}

          {stage === "paid" ? (
            <div className="payer-stage payer-status-stage">
              <div className="payer-success-mark">✓</div>
              <p className="eyebrow">Payment accepted</p>
              <h1>Payment received</h1>
              <p className="payer-stage-lead">Northstar Gaming has received confirmation of your €10,000.00 payment. Merchant settlement continues as a separate lifecycle.</p>
              <div className="payer-status-separation"><div><span>Payment status</span><StatusBadge label="Paid" tone="green" /></div><div><span>Settlement status</span><StatusBadge label="Processing" tone="blue" /></div></div>
              <dl className="payer-receipt"><div><dt>Payment reference</dt><dd>LNK-2051</dd></div><div><dt>Paid</dt><dd>{quoteAmount} {assetCode}</dd></div><div><dt>Payment value</dt><dd>€10,000.00</dd></div><div><dt>Network</dt><dd>{network}</dd></div></dl>
              <button className="button button-primary button-full payer-main-action" onClick={onPaymentAccepted} type="button">View merchant record</button>
              <button className="payer-restart" onClick={restartCheckout} type="button">Start another preview</button>
            </div>
          ) : null}
        </section>

        <aside className="payer-order-summary">
          <div className="payer-merchant"><span>NG</span><div><strong>Northstar Gaming</strong><small>Europe · fictional operator</small></div></div>
          <p className="eyebrow">Amount due</p>
          <h2>€10,000.00</h2>
          <p className="payer-order-description">Trading account funding</p>
          <dl><div><dt>Reference</dt><dd>LNK-2051</dd></div><div><dt>Customer</dt><dd>Demo Player 4120</dd></div><div><dt>Pay by</dt><dd>14 Aug 2026 · 17:00 CET</dd></div></dl>
          <div className="payer-order-status"><span>Payment status</span><StatusBadge label={checkoutStatus} tone={checkoutStatusTone} /></div>
          <div className="payer-order-note"><strong>Pay with approved crypto</strong><p>The merchant’s configured settlement currency and route stay behind this checkout.</p></div>
        </aside>
      </main>

      <footer className="payer-checkout-footer"><span>Secured by ONE Gateway</span><span>Target experience · Terms · Privacy</span></footer>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [selectedAccount, setSelectedAccount] = useState<MerchantAccount | null>(null);
  const [selectedWalletNetwork, setSelectedWalletNetwork] = useState("Polygon");
  const [exchangeFrom, setExchangeFrom] = useState("USD");
  const [exchangeTo, setExchangeTo] = useState("USDC");
  const [exchangeAmount, setExchangeAmount] = useState("25,000.00");
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeComplete, setExchangeComplete] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchStep, setBatchStep] = useState(0);
  const [oneTimePayoutOpen, setOneTimePayoutOpen] = useState(false);
  const [oneTimePayoutStage, setOneTimePayoutStage] = useState<OneTimePayoutStage>("recipient");
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [selectedRecipientId, setSelectedRecipientId] = useState(initialRecipients[0].id);
  const [newRecipientName, setNewRecipientName] = useState("Demo Player 4120");
  const [newRecipientKind, setNewRecipientKind] = useState<RecipientKind>("Bank account");
  const [newRecipientAssetCode, setNewRecipientAssetCode] = useState("EUR");
  const [newRecipientCountry, setNewRecipientCountry] = useState("Germany");
  const [newRecipientRail, setNewRecipientRail] = useState("SEPA");
  const [newRecipientBankDetails, setNewRecipientBankDetails] = useState("DEMO-BANK-EUR-4120");
  const [newRecipientNetwork, setNewRecipientNetwork] = useState("Polygon");
  const [newRecipientWallet, setNewRecipientWallet] = useState("DEMO-WALLET-USDC-4120");
  const [payoutAssetCode, setPayoutAssetCode] = useState("EUR");
  const [payoutFundingCode, setPayoutFundingCode] = useState("USDC");
  const [payoutAmount, setPayoutAmount] = useState("25,000.00");
  const [batchFundingCode, setBatchFundingCode] = useState("USD");
  const [payments, setPayments] = useState<PaymentRow[]>(initialPayments);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow>(initialPayments[3]);
  const [paymentFilter, setPaymentFilter] = useState<"All" | "Processing" | "Exceptions">("All");
  const [paymentBuilderOpen, setPaymentBuilderOpen] = useState(false);
  const [paymentBuilderComplete, setPaymentBuilderComplete] = useState(false);
  const [payerCheckoutOpen, setPayerCheckoutOpen] = useState(false);
  const [builderKind, setBuilderKind] = useState<PaymentKind>("Payment link");
  const [builderCustomer, setBuilderCustomer] = useState("Demo Player 4120");
  const [builderAmount, setBuilderAmount] = useState("10,000.00");
  const [paymentDetailOpen, setPaymentDetailOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSubmitted, setRefundSubmitted] = useState(false);
  const [flowMode, setFlowMode] = useState<"Stablecoin" | "Fiat">("Stablecoin");
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementRow>(settlementRows[0]);
  const [environment, setEnvironment] = useState<"Sandbox" | "Target live">("Sandbox");
  const [profileOpen, setProfileOpen] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>("iGaming operator");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const visiblePayments = useMemo(() => {
    if (paymentFilter === "Processing") return payments.filter((row) => row.status === "Processing");
    if (paymentFilter === "Exceptions") return payments.filter((row) => row.status === "Needs attention");
    return payments;
  }, [paymentFilter, payments]);

  const paymentStages = useMemo(() => {
    if (selectedPayment.status === "Needs attention") return ["Created", "Awaiting payment", "Processing", "Needs attention"];
    return ["Created", "Awaiting payment", "Processing", "Paid"];
  }, [selectedPayment.status]);

  const exchangeFromAsset = getAsset(exchangeFrom);
  const exchangeToAsset = getAsset(exchangeTo);
  const exchangeOutput = parseAssetAmount(exchangeAmount) * exchangeFromAsset.referenceUsd / exchangeToAsset.referenceUsd * 0.9975;
  const exchangeRoute = `${exchangeFromAsset.kind} → ${exchangeToAsset.kind}`;
  const selectedRecipient = recipients.find((recipient) => recipient.id === selectedRecipientId) ?? recipients[0];
  const payoutAsset = getAsset(payoutAssetCode);
  const payoutFundingAsset = getAsset(payoutFundingCode);
  const payoutFundingAmount = payoutFundingCode === payoutAssetCode
    ? parseAssetAmount(payoutAmount)
    : parseAssetAmount(payoutAmount) * payoutAsset.referenceUsd / payoutFundingAsset.referenceUsd * 1.0025;
  function openAccountDetails(account: MerchantAccount) {
    setSelectedAccount(account);
    if (account.kind === "Crypto wallet") setSelectedWalletNetwork(account.addresses[0].network);
  }

  function chooseRecipient(recipient: Recipient) {
    setSelectedRecipientId(recipient.id);
    setPayoutAssetCode(recipient.assetCode);
  }

  function resetOneTimePayout() {
    setOneTimePayoutStage("recipient");
  }

  function saveRecipient() {
    const asset = getAsset(newRecipientAssetCode);
    const destination = newRecipientKind === "Bank account"
      ? `${newRecipientBankDetails.slice(0, 4)}…${newRecipientBankDetails.replace(/\s/g, "").slice(-4)}`
      : `${newRecipientWallet.slice(0, 6)}…${newRecipientWallet.slice(-4)}`;
    const recipient: Recipient = {
      id: `recipient-${Date.now()}`,
      name: newRecipientName || "New recipient",
      kind: newRecipientKind,
      assetCode: asset.code,
      route: newRecipientKind === "Bank account" ? `${newRecipientRail} · ${newRecipientCountry}` : `${newRecipientNetwork} · External wallet`,
      destination,
      fullDestination: newRecipientKind === "Bank account" ? newRecipientBankDetails : newRecipientWallet,
      status: "Pending verification",
    };
    setRecipients((current) => [recipient, ...current]);
    chooseRecipient(recipient);
    setOneTimePayoutStage("recipient");
    setToast("Recipient saved for verification");
  }

  function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
    setToast(`${filename} downloaded`);
  }

  function createPaymentRequest() {
    const prefix = builderKind === "Invoice" ? "INV" : builderKind === "Payment link" ? "LNK" : "PAY";
    const created: PaymentRow = {
      reference: `${prefix}-2051`,
      type: builderKind,
      customer: builderCustomer || "New customer",
      amount: `€${builderAmount || "0.00"}`,
      settlement: "USDC smart account",
      settlementStatus: "Not started",
      status: "Awaiting payment",
      tone: "blue",
      stage: 1,
    };
    setPayments((current) => [created, ...current]);
    setSelectedPayment(created);
    setPaymentBuilderComplete(true);
  }

  function copyValue(value: string, label = "Value") {
    writeClipboard(value).then((copied) => setToast(copied ? `${label} copied to clipboard` : "Copy unavailable—select the value"));
  }

  function copyDemoValue(value: string, label: string) {
    if (!value.startsWith("DEMO-")) {
      setToast("Only fictional demo identifiers can be copied");
      return;
    }
    writeClipboard(value).then((copied) => setToast(copied ? `${label} copied · fictional demo data` : "Copy unavailable—select the demo value"));
  }

  function acceptCheckoutPayment() {
    const accepted: PaymentRow = {
      reference: "LNK-2051",
      type: "Payment link",
      customer: "Demo Player 4120",
      amount: "€10,000.00",
      settlement: "USDC smart account",
      settlementStatus: "Processing · route executing",
      status: "Paid",
      tone: "green",
      stage: 3,
    };
    setPayments((current) => [accepted, ...current.filter((row) => row.reference !== accepted.reference)]);
    setSelectedPayment(accepted);
    setPayerCheckoutOpen(false);
    setView("payments");
    setToast("Payment accepted; settlement is still processing");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (payerCheckoutOpen) {
    return <PaymentLinkCheckout onClose={() => setPayerCheckoutOpen(false)} onPaymentAccepted={acceptCheckoutPayment} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-symbol">1</span><span className="brand-word">ONE</span><span className="brand-product">Gateway</span></div>
        <div className="merchant-identity"><span className="merchant-avatar">NG</span><div><strong>Northstar Gaming</strong><small>Europe · fictional operator</small></div></div>

        <nav aria-label="Merchant dashboard">
          {navGroups.map((group, groupIndex) => (
            <div className="nav-group" key={group.label}>
              <p className={`nav-label ${groupIndex ? "nav-label-spaced" : ""}`}>{group.label}</p>
              {group.items.map((item) => <NavButton active={view === item.id} key={item.id} label={item.label} mark={item.mark} onClick={() => setView(item.id)} />)}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="activation-row"><span className="activation-dot activation-dot-blue" /><div><strong>Day 30 concept</strong><small>Illustrative discussion model</small></div></div>
          <button className="text-button" onClick={() => setProfileOpen(true)} type="button">View delivery scope</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Northstar Gaming Europe</span><span className="chevron">/</span><strong>{viewTitles[view]}</strong></div>
          <div className="topbar-actions">
            <button className="environment-pill" onClick={() => setProfileOpen(true)} type="button"><span className="concept-dot" /> Day 30 concept</button>
            <button className="icon-button" aria-label="Notifications" onClick={() => setToast("2 demo decisions are ready to review")} type="button">2</button>
            <div className="profile"><div><strong>Demo Admin</strong><small>Prototype administrator</small></div><span>DA</span></div>
          </div>
        </header>

        <div className="service-strip">
          <span className="service-icon">i</span>
          <p><strong>Illustrative prototype · do not send funds</strong> · Mock data and target journeys only; no live payment, wallet or banking rail is connected.</p>
          <button onClick={() => setProfileOpen(true)} type="button">View Day 30 / 60 / 90 scope</button>
        </div>

        <main className="main-content">
          {view === "overview" ? (
            <>
              <PageHeader title="Overview" description="Unified balances, availability and recent activity across fiat and crypto." />

              <section className="journey-progress panel">
                <div><p className="eyebrow">Merchant journey</p><strong>Activation → Checkout → Payment → Settlement</strong><small>All four moments are represented in this Day 30 target experience.</small></div>
                <button className="button button-secondary" onClick={() => setView("activation")} type="button">Start at onboarding</button>
              </section>

              <section className="smart-wallet-banner">
                <div className="smart-wallet-copy"><span className="feature-mark">A</span><div><div className="title-line"><h2>Accounts and wallets</h2><StatusBadge label="Mock interface" tone="green" /></div><p>Fiat accounts expose bank details; crypto wallets expose a network-specific receiving address.</p></div></div>
                <button className="button button-secondary" onClick={() => setView("accounts")} type="button">View all accounts & wallets</button>
              </section>

              <section className="balance-grid" aria-label="Illustrative balances">
                {[...fiatMerchantAccounts, cryptoMerchantAccounts[0]].map((account) => <BalanceCard account={account} key={account.id} onView={() => openAccountDetails(account)} />)}
              </section>

              <section className="panel receiving-wallets-panel">
                <div className="panel-heading"><div><h2>Receiving wallets</h2><p>Each wallet has its own asset, network and copyable demo address.</p></div><StatusBadge label="No live wallets" tone="gray" /></div>
                <div className="receiving-wallet-strip">
                  {cryptoMerchantAccounts.map((account) => {
                    const address = account.addresses[0];
                    return <article key={account.id}><span className="wallet-strip-mark" style={{ background: account.accent }}>{account.code.slice(0, 1)}</span><div><strong>{account.primary ? "Main stablecoin wallet" : account.name}</strong><small>{account.code} · {address.network}</small><code>{address.address}</code></div><button className="text-button" onClick={() => openAccountDetails(account)} type="button">View wallet details</button></article>;
                  })}
                </div>
              </section>

              <section className="panel staged-panel overview-stages">
                <div className="panel-heading"><div><h2>Balance stages</h2><p>Ledger availability is kept separate from observed wallet balances.</p></div><button className="text-button" onClick={() => setView("accounts")} type="button">View accounts, wallets & flow</button></div>
                <div className="stage-rail" aria-label="Balance stage distribution"><span className="stage-available" style={{ width: "76%" }} /><span className="stage-pending" style={{ width: "9%" }} /><span className="stage-held" style={{ width: "4%" }} /><span className="stage-converting" style={{ width: "6%" }} /><span className="stage-scheduled" style={{ width: "3%" }} /><span className="stage-transit" style={{ width: "2%" }} /></div>
                <div className="stage-list">
                  <div><span className="dot dot-green" /><p>Available<small>Ready for use or transfer</small></p><strong>€984,110</strong></div>
                  <div><span className="dot dot-blue" /><p>Pending<small>Received and still processing</small></p><strong>€116,420</strong></div>
                  <div><span className="dot dot-amber" /><p>Held<small>An exception is being resolved</small></p><strong>€8,750</strong></div>
                  <div><span className="dot dot-purple" /><p>Converting<small>A currency conversion is executing</small></p><strong>€42,680</strong></div>
                  <div><span className="dot dot-gray" /><p>Scheduled out<small>Reserved for an approved transfer</small></p><strong>€19,240</strong></div>
                  <div><span className="dot dot-dark" /><p>In transit<small>Sent and awaiting final settlement</small></p><strong>€11,980</strong></div>
                </div>
              </section>

              <section className="panel activity-panel">
                <div className="panel-heading"><div><h2>Recent money movement</h2><p>One merchant status model across fiat and crypto rails.</p></div><button className="text-button" onClick={() => setView("payments")} type="button">View payments</button></div>
                <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Type</th><th>Counterparty</th><th>Amount</th><th>Destination</th><th>Status</th></tr></thead><tbody>{payments.slice(0, 4).map((row) => <tr key={row.reference}><td><strong>{row.reference}</strong></td><td>{row.type}</td><td>{row.customer}</td><td><strong>{row.amount}</strong></td><td>{row.settlement}</td><td><StatusBadge label={row.status} tone={row.tone} /></td></tr>)}</tbody></table></div>
              </section>
            </>
          ) : null}

          {view === "exchange" ? (
            <>
              <PageHeader title="Exchange" description="Convert between available fiat currencies and crypto assets from one unified balance." />

              <div className="exchange-layout">
                <section className="panel exchange-ticket">
                  <div className="panel-heading"><div><h2>Exchange currencies</h2><p>Choose any available source and destination asset.</p></div><StatusBadge label={exchangeRoute} tone="blue" /></div>
                  <div className="exchange-field">
                    <div className="exchange-field-heading"><label htmlFor="exchange-from">You exchange</label><span>Available · {exchangeFromAsset.balance}</span></div>
                    <div><input aria-label="Exchange amount" id="exchange-amount" onChange={(event) => setExchangeAmount(event.target.value)} value={exchangeAmount} /><select aria-label="Exchange from currency" id="exchange-from" onChange={(event) => { const next = event.target.value; setExchangeFrom(next); if (next === exchangeTo) setExchangeTo(next === "USD" ? "USDC" : "USD"); }} value={exchangeFrom}><AssetOptions /></select></div>
                  </div>
                  <button className="exchange-direction" aria-label="Reverse exchange direction" onClick={() => { setExchangeFrom(exchangeTo); setExchangeTo(exchangeFrom); }} type="button">⇅</button>
                  <div className="exchange-field exchange-field-receive">
                    <div className="exchange-field-heading"><label htmlFor="exchange-to">You receive</label><span>{exchangeToAsset.kind === "Crypto" ? `${exchangeToAsset.networks?.join(" · ")}` : "ONE balance account"}</span></div>
                    <div><strong>{formatAssetAmount(exchangeOutput, exchangeToAsset)}</strong><select aria-label="Exchange to currency" id="exchange-to" onChange={(event) => { const next = event.target.value; setExchangeTo(next); if (next === exchangeFrom) setExchangeFrom(next === "USD" ? "USDC" : "USD"); }} value={exchangeTo}><AssetOptions /></select></div>
                  </div>
                  <dl className="exchange-quote"><div><dt>Indicative route</dt><dd>{exchangeFrom} → {exchangeTo}</dd></div><div><dt>Indicative rate</dt><dd>1 {exchangeFrom} = {(exchangeFromAsset.referenceUsd / exchangeToAsset.referenceUsd * 0.9975).toLocaleString("en-US", { maximumFractionDigits: 8 })} {exchangeTo}</dd></div><div><dt>Illustrative spread / fee</dt><dd>0.25%</dd></div><div><dt>Quote validity</dt><dd>60 seconds after review</dd></div></dl>
                  <button className="button button-primary button-full" onClick={() => { setExchangeComplete(false); setExchangeOpen(true); }} type="button">Review exchange</button>
                  <small className="availability-note">All available currencies are shown for the target experience. Actual availability depends on entity, region and approved route.</small>
                </section>

                <aside className="panel asset-directory">
                  <div className="panel-heading"><div><h2>Available currencies</h2><p>One catalog across balances, exchange and payouts.</p></div></div>
                  <div className="asset-directory-group"><span>Fiat</span><div>{fiatAssets.map((asset) => <button key={asset.code} onClick={() => setExchangeFrom(asset.code)} type="button"><b>{asset.code}</b><small>{asset.name}</small></button>)}</div></div>
                  <div className="asset-directory-group"><span>Crypto</span><div>{cryptoAssets.map((asset) => <button key={asset.code} onClick={() => setExchangeTo(asset.code)} type="button"><b>{asset.code}</b><small>{asset.networks?.join(" / ")}</small></button>)}</div></div>
                  <div className="exchange-boundary"><strong>Unified interface, explicit execution</strong><p>Fiat/fiat, fiat/crypto, crypto/fiat and crypto/crypto conversions use the same merchant object while preserving the actual route, provider evidence and settlement status.</p></div>
                </aside>
              </div>

              <section className="panel activity-panel">
                <div className="panel-heading"><div><h2>Exchange activity</h2><p>Every conversion retains the sold asset, received asset, route and status.</p></div><StatusBadge label="Illustrative data" tone="gray" /></div>
                <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Pair</th><th>Type</th><th>Exchanged</th><th>Received</th><th>Status</th></tr></thead><tbody>{exchangeRows.map((row) => <tr key={row.reference}><td><strong>{row.reference}</strong></td><td>{row.pair}</td><td>{row.type}</td><td><strong>{row.sold}</strong></td><td><strong>{row.bought}</strong></td><td><StatusBadge label={row.status} tone={row.tone} /></td></tr>)}</tbody></table></div>
              </section>
            </>
          ) : null}

          {view === "activation" ? (
            <>
              <PageHeader title="Merchant activation" description="Where entity, KYB, information exchange, terms and approval sit in the plan.">
                <button className="button button-secondary" onClick={() => setProfileOpen(true)} type="button">View delivery gates</button>
                <button className="button button-primary" onClick={() => setView("accounts")} type="button">Continue to account setup</button>
              </PageHeader>

              <section className="activation-summary panel">
                <div><p className="eyebrow">Target onboarding state</p><h2>Merchant inputs, reviews and activation in one journey</h2><p>Sandbox acceptance depends on approved entity, eligibility, service perimeter and customer-facing terms.</p></div>
                <div className="activation-summary-stats"><div><strong>Inputs</strong><span>Entity + KYB + terms</span></div><div><strong>Sandbox</strong><span>Approved journey</span></div><div><strong>Live</strong><span>Activation decision</span></div></div>
              </section>

              <div className="activation-layout">
                <section className="panel activation-panel">
                  <div className="panel-heading"><div><h2>Activation journey</h2><p>Illustrative merchant state, with the real dependency owner shown.</p></div><StatusBadge label="Target flow" tone="blue" /></div>
                  <div className="activation-list">
                    {activationSteps.map((step, index) => (
                      <article key={step.title}>
                        <span className="activation-index">{index + 1}</span>
                        <div className="activation-copy"><div><strong>{step.title}</strong><StatusBadge label={step.status} tone={step.tone} /></div><p>{step.detail}</p><small><b>{step.owner}</b> · {step.due}</small></div>
                      </article>
                    ))}
                  </div>
                </section>

                <aside className="panel dependency-panel">
                  <div className="panel-heading"><div><p className="eyebrow">ONE dependency</p><h2>What we need, and when</h2></div></div>
                  <ul className="dependency-list">
                    <li><span>1</span><div><strong>Entity and perimeter</strong><p>Contracting entity, eligible customer types, jurisdictions and regulated service perimeter.</p></div></li>
                    <li><span>2</span><div><strong>KYB and terms</strong><p>Evidence requirements plus technical and customer-facing service terms substance.</p></div></li>
                    <li><span>3</span><div><strong>Routes and controls</strong><p>Custody/control model, assets, networks, settlement modes and approval rules.</p></div></li>
                    <li><span>4</span><div><strong>Activation authority</strong><p>Product, Compliance, Legal, Banking, Trading and Commercial approval before live access.</p></div></li>
                  </ul>
                  <div className="responsibility-note"><strong>Clearer / V3 contribution</strong><p>Design the journey, information structure, technical acceptance and terms placement. ONE retains entity selection, legal substance, eligibility and activation authority.</p></div>
                </aside>
              </div>
            </>
          ) : null}

          {view === "accounts" ? (
            <>
              <PageHeader title="Accounts & wallets" description="View receiving instructions for every fiat account and network-specific crypto wallet.">
                <div className="segmented-control" aria-label="Settlement mode">{(["Stablecoin", "Fiat"] as const).map((mode) => <button className={flowMode === mode ? "selected" : ""} key={mode} onClick={() => setFlowMode(mode)} type="button">{mode}</button>)}</div>
              </PageHeader>

              <section className="panel account-library-boundary">
                <span className="feature-mark">i</span><div><strong>Interface-only account library</strong><p>Every value below is fictional and intentionally invalid. The target experience shows what a merchant could view and copy; it does not provision an account, generate keys or create custody.</p></div><StatusBadge label="Do not send funds" tone="amber" />
              </section>

              <section className="account-library-section">
                <div className="panel-heading"><div><h2>Fiat accounts</h2><p>Named receiving instructions with the correct fields for each rail.</p></div><StatusBadge label="3 mock accounts" tone="blue" /></div>
                <div className="account-library-grid">{fiatMerchantAccounts.map((account) => <BalanceCard account={account} key={account.id} onView={() => openAccountDetails(account)} />)}</div>
              </section>

              <section className="account-library-section">
                <div className="panel-heading"><div><h2>Crypto wallets</h2><p>A primary stablecoin wallet plus network-specific Bitcoin and Solana wallets.</p></div><StatusBadge label="3 mock wallets" tone="green" /></div>
                <div className="account-library-grid">{cryptoMerchantAccounts.map((account) => <BalanceCard account={account} key={account.id} onView={() => openAccountDetails(account)} />)}</div>
              </section>

              <section className="panel account-decisions-bar">
                <div><span className="feature-mark">D</span><div><strong>Day 30 decisions behind this interface</strong><p>Issuer and account structure · custody/control model · initial assets and networks · settlement routes · completion and reconciliation evidence.</p></div></div><StatusBadge label="Decision required" tone="amber" />
              </section>

              <section className="panel funds-flow-panel">
                <div className="panel-heading"><div><h2>{flowMode} settlement funds flow</h2><p>Connected rails, proposed ONE experience and unresolved decisions are kept distinct.</p></div><div className="flow-legend"><span><i className="legend-green" />Merchant / ONE experience</span><span><i className="legend-blue" />Provider rail</span><span><i className="legend-amber" />Decision required</span></div></div>
                {flowMode === "Stablecoin" ? (
                  <div className="funds-flow"><FlowNode title="Checkout or API" owner="ONE experience" detail="Invoice, payment intent, status" tone="green" /><span className="funds-arrow">→</span><FlowNode title="Gateway controls" owner="ONE" detail="Eligibility, fees, destination" tone="green" /><span className="funds-arrow">→</span><FlowNode title="Quote, screen & route" owner="Approved adapter" detail="Provider execution evidence" tone="blue" /><span className="funds-arrow">→</span><FlowNode title="USDC smart account" owner="Merchant" detail="Signing and wallet policy" tone="green" /><span className="funds-arrow">→</span><FlowNode title="Available balance" owner="ONE ledger view" detail="Matched and reconciled" tone="green" /></div>
                ) : (
                  <div className="funds-flow funds-flow-fiat"><FlowNode title="Checkout or API" owner="ONE experience" detail="Invoice, payment intent, status" tone="green" /><span className="funds-arrow">→</span><FlowNode title="Stablecoin settlement" owner="Approved adapter" detail="Screen, convert, deliver" tone="blue" /><span className="funds-arrow">→</span><FlowNode title="Off-ramp destination" owner="Decision required" detail="Wallet sweep or direct route" tone="amber" /><span className="funds-arrow">→</span><FlowNode title="FX execution" owner="Approved liquidity route" detail="Trade and fill evidence" tone="blue" /><span className="funds-arrow">→</span><FlowNode title="Ledger credit & bank payout" owner="ONE" detail="Reconcile, credit, pay out" tone="green" /></div>
                )}
                <div className="flow-boundary-grid"><div><strong>Gateway V3 owns</strong><p>Customer contract, payment intent, configuration, eligibility, lifecycle, exceptions and reconciliation.</p></div><div><strong>Merchant owns</strong><p>Smart-account signing, policy, approved destinations, limits and required approvals.</p></div><div><strong>ONE retains</strong><p>KYB, eligibility, compliance decisions, regulated off-ramp, ledger credit and bank payout.</p></div><div><strong>Not implied</strong><p>A smart account does not execute the OTC trade or turn crypto into fiat by itself.</p></div></div>
              </section>
            </>
          ) : null}

          {view === "payments" ? (
            <>
              <PageHeader title="Checkout & payment lifecycle" description="Payment links, invoices, hosted checkout and API payments through acceptance.">
                <button className="button button-secondary" onClick={() => setPayerCheckoutOpen(true)} type="button">Preview payment link</button>
                <button className="button button-secondary" onClick={() => downloadText("gateway-v3-payments-sample.csv", "reference,type,status,settlement\nINV-2048,payment_link,paid,scheduled\nPAY-8F19,hosted_checkout,needs_attention,paused\n")} type="button">Export</button>
                <button className="button button-primary" onClick={() => { setPaymentBuilderComplete(false); setPaymentBuilderOpen(true); }} type="button">Create payment request</button>
              </PageHeader>

              <section className="object-lifecycle panel">
                <div><span>Reusable entry point</span><strong>checkout.demo.invalid/northstar</strong><small>Persistent demo URL · Illustrative</small></div><b>→</b><div><span>Execution session</span><strong>Fresh invoice + address</strong><small>Created per payer attempt</small></div><b>→</b><div><span>Quote</span><strong>60-second price</strong><small>Separate from link lifetime</small></div><b>→</b><div><span>Deposit address</span><strong>48-hour route</strong><small>Not a permanent client address</small></div>
              </section>

              <section className="metric-grid"><div><span>Awaiting payment</span><strong>12</strong><small>€84,950 expected</small></div><div><span>Processing</span><strong>7</strong><small>Normal checks and conversion</small></div><div><span>Paid today</span><strong>38</strong><small>€214,680 accepted</small></div><div><span>Needs attention</span><strong>2</strong><small>Verification or route exception</small></div></section>

              <div className="payments-layout">
                <section className="panel activity-panel">
                  <div className="panel-heading"><div><h2>Payments, links and invoices</h2><p>Select an object to inspect its merchant-visible lifecycle.</p></div><div className="filter-row">{(["All", "Processing", "Exceptions"] as const).map((filter) => <button className={paymentFilter === filter ? "filter-active" : ""} key={filter} onClick={() => setPaymentFilter(filter)} type="button">{filter}</button>)}</div></div>
                  <div className="table-wrap"><table className="clickable-table"><thead><tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Settlement preference</th><th>Status</th></tr></thead><tbody>{visiblePayments.map((row) => <tr className={selectedPayment.reference === row.reference ? "selected-row" : ""} key={row.reference} onClick={() => setSelectedPayment(row)}><td><strong>{row.reference}</strong><small>{row.type}</small></td><td>{row.customer}</td><td><strong>{row.amount}</strong></td><td>{row.settlement}</td><td><StatusBadge label={row.status} tone={row.tone} /></td></tr>)}</tbody></table></div>
                </section>

                <aside className="panel flow-panel">
                  <div className="flow-title"><div><p className="eyebrow">Payment lifecycle</p><h2>{selectedPayment.reference}</h2></div><StatusBadge label={selectedPayment.status} tone={selectedPayment.tone} /></div>
                  <div className="amount-hero"><strong>{selectedPayment.amount}</strong><span>{selectedPayment.customer}</span></div>
                  <ol className="flow-list">{paymentStages.map((stage, index) => { const completed = index < selectedPayment.stage; const active = index === selectedPayment.stage; return <li className={completed ? "flow-complete" : active ? "flow-active" : ""} key={stage}><span>{completed ? "✓" : index + 1}</span><div><strong>{stage}</strong><small>{active ? "Current merchant-visible status" : completed ? "Completed" : "Not started"}</small></div></li>; })}</ol>
                  <div className="settlement-separation"><span>Settlement status</span><strong>{selectedPayment.settlementStatus}</strong><small>“Paid” confirms acceptance; settlement remains a separate lifecycle.</small></div>
                  {selectedPayment.exception ? <div className="exception-note"><StatusBadge label="Merchant action" tone="amber" /><strong>{selectedPayment.exception}</strong><p>Provider screening detail stays in the audit trail; the merchant sees a safe reason and case reference.</p></div> : <div className="processing-note"><strong>Provider detail stays behind ONE states.</strong><p>Confirmations, screening and conversion remain in the audit trail without becoming headline statuses.</p></div>}
                  <div className="stacked-actions">{selectedPayment.status === "Paid" ? <button className="button button-secondary" onClick={() => { setRefundSubmitted(false); setRefundOpen(true); }} type="button">Request refund</button> : null}<button className="button button-secondary" onClick={() => setPaymentDetailOpen(true)} type="button">Open payment details</button></div>
                </aside>
              </div>
            </>
          ) : null}

          {view === "payouts" ? (
            <>
              <PageHeader title="Payouts" description="Send one payout or submit a controlled batch, funded from fiat or crypto." />

              <section className="payout-mode-grid" aria-label="Choose payout type">
                <article className="panel payout-mode-card">
                  <div className="payout-mode-heading"><span className="payout-mode-mark">1</span><div><p className="eyebrow">One recipient</p><h2>One-time payout</h2></div><StatusBadge label="Target flow" tone="blue" /></div>
                  <p>Choose a saved recipient and send to an already captured bank account or wallet.</p>
                  <ul><li>Select from the recipient library dropdown</li><li>Create and verify new destinations separately</li><li>Fund from any approved fiat or crypto balance</li></ul>
                  <button className="button button-primary button-full" onClick={() => { resetOneTimePayout(); chooseRecipient(selectedRecipient); setOneTimePayoutOpen(true); }} type="button">Create one-time payout</button>
                </article>

                <article className="panel payout-mode-card payout-mode-card-candidate">
                  <div className="payout-mode-heading"><span className="payout-mode-mark payout-mode-mark-batch">B</span><div><p className="eyebrow">Multiple recipients</p><h2>Batch payout</h2></div><StatusBadge label="Day 60 candidate" tone="amber" /></div>
                  <p>Upload mixed fiat and crypto recipients by CSV or API, then validate and approve every destination.</p>
                  <ul><li>Bank and wallet destinations in one batch</li><li>Any approved funding currency or asset</li><li>Partial completion and item-level evidence</li></ul>
                  <div className="payout-mode-actions"><button className="button button-secondary" onClick={() => downloadText("gateway-v3-payout-template.csv", "external_reference,recipient_name,asset,amount,destination_type,country,rail,iban,account_number,routing_code,swift_bic,network,wallet_address,memo\ndemo-001,Demo Player 1042,EUR,25000,bank,DE,SEPA,DEMO-BANK-EUR-1042,,,,,,\ndemo-002,Demo Player 2088,USDC,8500,wallet,,,,,,,polygon,DEMO-WALLET-USDC-2088,\n")} type="button">Download template</button><button className="button button-primary" onClick={() => { setBatchStep(0); setBatchOpen(true); }} type="button">Create batch payout</button></div>
                  <div className="payout-candidate-note"><strong>Pending Day 30 decision</strong><span>Mixed-recipient batch orchestration is proposed scope, not demonstrated live capability.</span><button className="text-button" onClick={() => setProfileOpen(true)} type="button">See boundary</button></div>
                </article>
              </section>

              <section className="asset-coverage-strip panel"><div><strong>All available currencies</strong><span>Fiat</span>{fiatAssets.map((asset) => <b key={asset.code}>{asset.code}</b>)}</div><div><strong>Crypto</strong>{cryptoAssets.map((asset) => <b key={asset.code}>{asset.code}</b>)}</div><small>Destination fields adapt to bank rail, currency, crypto asset and network. Availability depends on entity, region and approved route.</small></section>

              <section className="payout-intro"><div className="payout-steps"><div className="payout-step complete"><span>1</span><p><strong>Choose mode</strong><small>One-time or batch</small></p></div><div className="payout-line" /><div className="payout-step active"><span>2</span><p><strong>Add recipients</strong><small>Enter, CSV or API</small></p></div><div className="payout-line" /><div className="payout-step"><span>3</span><p><strong>Validate</strong><small>Destination & policy</small></p></div><div className="payout-line" /><div className="payout-step"><span>4</span><p><strong>Approve & send</strong><small>Fiat or crypto</small></p></div><div className="payout-line" /><div className="payout-step"><span>5</span><p><strong>Reconcile</strong><small>Transfer-level results</small></p></div></div></section>

              <section className="metric-grid metric-grid-three"><div><span>Scheduled</span><strong>2</strong><small>One-time and batch payouts</small></div><div><span>Sending</span><strong>4</strong><small>Across 2 payout instructions</small></div><div><span>Completed in sample</span><strong>136</strong><small>Single and recipient-level results</small></div></section>

              <section className="panel activity-panel">
                <div className="panel-heading"><div><h2>Payout activity</h2><p>One-time and batch payouts share merchant-readable statuses and transfer-level evidence.</p></div><button className="text-button" onClick={() => downloadText("gateway-v3-payout-reconciliation-sample.csv", "reference,type,item,status,reason\nOUT-4026,one_time,001,paid,\nBAT-0183,batch,042,held,recipient_verification\n")} type="button">Export reconciliation</button></div>
                <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Type</th><th>Recipient(s)</th><th>Funding route</th><th>Amount</th><th>Result</th><th>Status</th></tr></thead><tbody>{payoutActivityRows.map((row) => <tr key={row.reference}><td><strong>{row.reference}</strong><small>{row.name}</small></td><td>{row.type}</td><td>{row.count}</td><td>{row.route}</td><td><strong>{row.amount}</strong></td><td>{row.detail}</td><td><StatusBadge label={row.status} tone={row.tone} /></td></tr>)}</tbody></table></div>
              </section>
            </>
          ) : null}

          {view === "settlements" ? (
            <>
              <PageHeader title="Settlements" description="The merchant-visible path from accepted payments to first credited settlement.">
                <button className="button button-secondary" onClick={() => downloadText("gateway-v3-settlement-reconciliation-sample.csv", "settlement,payments,route,amount,status,matched\nSET-1048,17,USDC-EUR,54290.40,settled,17\n")} type="button">Export reconciliation</button>
                <button className="button button-primary" onClick={() => setView("reporting")} type="button">Open reporting</button>
              </PageHeader>

              <section className="metric-grid"><div><span>Scheduled</span><strong>1</strong><small>€38,840.00 today</small></div><div><span>Processing</span><strong>1</strong><small>28,400 USDC in flight</small></div><div><span>Settled this month</span><strong>26</strong><small>100% matched in sample</small></div><div><span>Action required</span><strong>1</strong><small>One source exception</small></div></section>

              <div className="payments-layout">
                <section className="panel activity-panel">
                  <div className="panel-heading"><div><h2>Settlement activity</h2><p>Payment acceptance and merchant settlement remain distinct.</p></div><StatusBadge label="Illustrative data" tone="gray" /></div>
                  <div className="table-wrap"><table className="clickable-table"><thead><tr><th>Settlement</th><th>Source</th><th>Route</th><th>Amount</th><th>Matched</th><th>Status</th></tr></thead><tbody>{settlementRows.map((row) => <tr className={selectedSettlement.reference === row.reference ? "selected-row" : ""} key={row.reference} onClick={() => setSelectedSettlement(row)}><td><strong>{row.reference}</strong><small>{row.label}</small></td><td>{row.source}</td><td>{row.route}</td><td><strong>{row.amount}</strong></td><td>{row.matched}</td><td><StatusBadge label={row.status} tone={row.tone} /></td></tr>)}</tbody></table></div>
                </section>

                <aside className="panel flow-panel settlement-detail">
                  <div className="flow-title"><div><p className="eyebrow">First-settlement detail</p><h2>{selectedSettlement.reference}</h2></div><StatusBadge label={selectedSettlement.status} tone={selectedSettlement.tone} /></div>
                  <div className="amount-hero"><strong>{selectedSettlement.amount}</strong><span>{selectedSettlement.destination}</span></div>
                  <ol className="flow-list">{["Payments accepted", "Stablecoin settled", "FX execution", "Merchant credited", "Bank payout settled"].map((stage, index) => { const completed = index < selectedSettlement.step; const active = index === selectedSettlement.step; return <li className={completed ? "flow-complete" : active ? "flow-active" : ""} key={stage}><span>{completed ? "✓" : index + 1}</span><div><strong>{stage}</strong><small>{active ? "Current settlement stage" : completed ? "Evidence matched" : "Not started"}</small></div></li>; })}</ol>
                  <dl className="detail-list settlement-evidence"><div><dt>Payment matches</dt><dd>{selectedSettlement.matched}</dd></div><div><dt>Route</dt><dd>{selectedSettlement.route}</dd></div><div><dt>Fees</dt><dd>€184.20</dd></div><div><dt>Bank reference</dt><dd>ONE-SET-1048</dd></div></dl>
                  <button className="button button-secondary button-full" onClick={() => downloadText(`${selectedSettlement.reference}-reconciliation.csv`, "object,reference,status\npayment,INV-2048,matched\nsettlement,SET-1048,settled\n")} type="button">Download evidence pack</button>
                </aside>
              </div>
            </>
          ) : null}

          {view === "reporting" ? (
            <>
              <PageHeader title="Reporting & reconciliation" description="Exports that let Finance connect payment, settlement, refund and payout records.">
                <button className="button button-primary" onClick={() => downloadText("gateway-v3-full-reconciliation-sample.csv", "object,reference,status,amount\npayment,INV-2048,paid,12400\nsettlement,SET-1048,settled,54290.40\n")} type="button">Export all</button>
              </PageHeader>

              <section className="report-grid">
                {[
                  ["Payments", "Invoices, links and API attempts with payment and settlement status.", "gateway-v3-payments.csv", "reference,type,payment_status,settlement_status\nINV-2048,payment_link,paid,scheduled\n"],
                  ["Settlement reconciliation", "Sources, fees, conversions, destination credit and bank references.", "gateway-v3-settlements.csv", "reference,source,route,status\nSET-1048,17 payments,USDC-EUR,settled\n"],
                  ["Refunds & exceptions", "Case-safe reasons, approvals, original payment and resolution state.", "gateway-v3-refunds-exceptions.csv", "reference,type,status,reason\nPAY-8F19,exception,action_required,verification\n"],
                  ["Payout recipients", "Batch and item-level results, including held and failed recipients.", "gateway-v3-payout-items.csv", "batch,item,status\nBAT-0183,001,paid\nBAT-0183,042,held\n"],
                ].map(([title, detail, filename, content]) => <article className="panel report-card" key={title}><span className="feature-mark">{title.slice(0, 1)}</span><div><h2>{title}</h2><p>{detail}</p><small>CSV · illustrative schema</small></div><button className="button button-secondary" onClick={() => downloadText(filename, content)} type="button">Download</button></article>)}
              </section>

              <div className="reporting-layout">
                <section className="panel activity-panel"><div className="panel-heading"><div><h2>Reconciliation health</h2><p>Sample control view for Finance and Operations.</p></div><StatusBadge label="99.6% matched" tone="green" /></div><div className="recon-bars"><div><span>Payments to settlement</span><b><i style={{ width: "100%" }} /></b><strong>17 / 17</strong></div><div><span>Provider events to ONE objects</span><b><i style={{ width: "98%" }} /></b><strong>52 / 53</strong></div><div><span>Payout recipients</span><b><i style={{ width: "90%" }} /></b><strong>38 / 42</strong></div></div></section>
                <aside className="panel exception-queue"><div className="panel-heading"><div><h2>Open reconciliation items</h2><p>Safe reason categories, not raw provider flags.</p></div></div><ul><li><StatusBadge label="Verification" tone="amber" /><div><strong>PAY-8F19</strong><small>Merchant information required</small></div></li><li><StatusBadge label="Recipient" tone="amber" /><div><strong>BAT-0183-042</strong><small>Destination review</small></div></li><li><StatusBadge label="Technical" tone="blue" /><div><strong>EVT-9182</strong><small>Webhook retrying</small></div></li></ul></aside>
              </div>
            </>
          ) : null}

          {view === "developer" ? (
            <>
              <PageHeader title="Developer" description="The target API, sandbox and normalized-event experience for Gateway V3.">
                <div className="segmented-control" aria-label="Environment">{(["Sandbox", "Target live"] as const).map((item) => <button className={environment === item ? "selected" : ""} key={item} onClick={() => setEnvironment(item)} type="button">{item}</button>)}</div>
              </PageHeader>

              <section className="integration-status panel">
                <div className="integration-copy"><span className="feature-mark">✓</span><div><h2>{environment === "Sandbox" ? "Sandbox contract is demo-ready" : "Target live environment is not activated"}</h2><p>{environment === "Sandbox" ? "Illustrative credentials, checkout calls and normalized events are represented." : "Production access follows compliance approval and the Day 90 timetable."}</p></div></div>
                <div className="integration-metrics"><div><span>Event examples</span><strong>5 / 5</strong></div><div><span>Target checks</span><strong>4 / 6</strong></div><div><span>Live rails</span><strong>0</strong></div></div>
              </section>

              <div className="developer-grid">
                <section className="panel credentials-panel">
                  <div className="panel-heading"><div><h2>Illustrative API credentials</h2><p>Separate keys and controls for sandbox and target live environments.</p></div><button className="button button-secondary" onClick={() => setToast("Illustrative sandbox key created")} type="button">Create demo key</button></div>
                  <div className="credential-row"><div><StatusBadge label="Illustrative" tone="gray" /><strong>{environment === "Sandbox" ? "Sandbox server" : "Target production server"}</strong><small>No secret or live access is represented</small></div><code>{environment === "Sandbox" ? "one_test_••••••••2J7N" : "one_live_••••••••pending"}</code><button onClick={() => copyValue(environment === "Sandbox" ? "one_test_demo_2J7N" : "pending")} type="button">Copy</button></div>
                  <div className="endpoint"><span>Illustrative base URL</span><code>{environment === "Sandbox" ? "https://sandbox.gateway-demo.invalid/v3" : "https://gateway-demo.invalid/v3"}</code><button onClick={() => copyValue(environment === "Sandbox" ? "https://sandbox.gateway-demo.invalid/v3" : "https://gateway-demo.invalid/v3")} type="button">Copy</button></div>
                </section>

                <aside className="panel readiness-panel">
                  <div className="panel-heading compact"><div><p className="eyebrow">Illustrative sandbox target</p><h2>Core contract plus open decisions</h2></div><span className="readiness-ring readiness-ring-amber">Demo</span></div>
                  <ul><li><span>✓</span>Payment-intent contract drafted</li><li><span>✓</span>Normalized webhook map</li><li><span>✓</span>Checkout lifecycle wireframed</li><li><span>✓</span>Settlement evidence mapped</li><li className="readiness-pending"><span>!</span>Vendor access and route matrix</li><li className="readiness-pending"><span>!</span>Compliance and architecture approval</li></ul>
                </aside>
              </div>

              <section className="panel activity-panel"><div className="panel-heading"><div><h2>Sample webhook events</h2><p>ONE states stay stable even when provider states change.</p></div><button className="text-button" onClick={() => setToast("Event catalogue: payment.*, settlement.*, refund.*, payout.*")} type="button">View event catalogue</button></div><div className="table-wrap"><table><thead><tr><th>Event</th><th>Object</th><th>Delivery</th><th>Observed</th></tr></thead><tbody>{developerEvents.map((event) => <tr key={event[0] + event[1]}><td><code>{event[0]}</code></td><td><strong>{event[1]}</strong></td><td><StatusBadge label={event[2]} tone="green" /></td><td>{event[3]}</td></tr>)}</tbody></table></div></section>
            </>
          ) : null}
        </main>
      </section>

      {selectedAccount ? <AccountDetailModal account={selectedAccount} onClose={() => setSelectedAccount(null)} onCopy={copyDemoValue} onNetworkChange={setSelectedWalletNetwork} selectedNetwork={selectedWalletNetwork} /> : null}

      {exchangeOpen ? (
        <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="exchange-review-title"><button className="modal-close" aria-label="Close" onClick={() => { setExchangeOpen(false); setExchangeComplete(false); }} type="button">×</button>{!exchangeComplete ? <><p className="eyebrow">Review exchange · {exchangeRoute}</p><h2 id="exchange-review-title">Exchange {exchangeFrom} to {exchangeTo}</h2><p className="modal-lead">Confirm the currencies, indicative output and target destination before starting the conversion.</p><div className="swap-field"><span className="swap-label">Exchange</span><div><strong>{formatAssetAmount(parseAssetAmount(exchangeAmount), exchangeFromAsset)}</strong><span>{exchangeFromAsset.balance} available</span></div></div><div className="swap-arrow">↓</div><div className="swap-field"><span className="swap-label">Receive</span><div><strong>{formatAssetAmount(exchangeOutput, exchangeToAsset)}</strong><span>{exchangeToAsset.kind === "Fiat" ? `${exchangeTo} balance account` : `${exchangeToAsset.networks?.[0]} balance`}</span></div></div><dl className="quote-details"><div><dt>Route</dt><dd>{exchangeFrom} → {exchangeTo}</dd></div><div><dt>Illustrative rate</dt><dd>1 {exchangeFrom} = {(exchangeFromAsset.referenceUsd / exchangeToAsset.referenceUsd * 0.9975).toLocaleString("en-US", { maximumFractionDigits: 8 })} {exchangeTo}</dd></div><div><dt>Illustrative spread / fee</dt><dd>0.25%</dd></div><div><dt>Quote expires</dt><dd>00:60</dd></div></dl><button className="button button-primary button-full" onClick={() => setExchangeComplete(true)} type="button">Confirm exchange</button></> : <div className="success-state"><span>✓</span><h2 id="exchange-review-title">Exchange started</h2><p><strong>{formatAssetAmount(parseAssetAmount(exchangeAmount), exchangeFromAsset)}</strong> is now converting to <strong>{formatAssetAmount(exchangeOutput, exchangeToAsset)}</strong>. Availability follows execution and reconciliation evidence.</p><button className="button button-primary" onClick={() => { setExchangeComplete(false); setExchangeOpen(false); setView("exchange"); }} type="button">View exchange activity</button></div>}</section></div>
      ) : null}

      {paymentBuilderOpen ? (
        <div className="modal-backdrop"><section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><button className="modal-close" aria-label="Close" onClick={() => setPaymentBuilderOpen(false)} type="button">×</button>{!paymentBuilderComplete ? <><p className="eyebrow">Checkout + lifecycle</p><h2 id="request-title">Create payment request</h2><p className="modal-lead">Use one merchant builder for a reusable link, invoice, hosted checkout or API payment intent.</p><div className="kind-selector">{(["Payment link", "Invoice", "Hosted checkout", "API payment"] as PaymentKind[]).map((kind) => <button className={builderKind === kind ? "selected" : ""} key={kind} onClick={() => setBuilderKind(kind)} type="button">{kind}</button>)}</div><div className="form-grid"><label>Customer<input value={builderCustomer} onChange={(event) => setBuilderCustomer(event.target.value)} /></label><label>Amount (EUR)<input value={builderAmount} onChange={(event) => setBuilderAmount(event.target.value)} /></label><label>Settlement<select defaultValue="USDC smart account"><option>USDC smart account</option><option>EUR operating account</option></select></label><label>Payment window<select defaultValue="48 hours"><option>48 hours</option><option>24 hours</option><option>7 days</option></select></label></div><div className="checkout-preview"><div><p className="eyebrow">Payer preview</p><strong>Pay {builderAmount || "0.00"} EUR</strong><span>{builderCustomer || "New customer"}</span></div><div className="checkout-methods"><span>Wallet</span><span>Exchange</span><span>QR / deposit</span></div><small>A fresh execution session, quote and deposit address are created for each attempt.</small></div><button className="button button-primary button-full" onClick={createPaymentRequest} type="button">Create target request</button></> : <div className="success-state"><span>✓</span><h2>Payment request created</h2><p><strong>{builderKind}</strong> LNK-2051 is now <strong>Awaiting payment</strong>. The reusable entry point is separate from its short-lived quote and generated address.</p><button className="button button-primary" onClick={() => { setPaymentBuilderComplete(false); setPaymentBuilderOpen(false); setView("payments"); }} type="button">View lifecycle</button></div>}</section></div>
      ) : null}

      {paymentDetailOpen ? (
        <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close" aria-label="Close" onClick={() => setPaymentDetailOpen(false)} type="button">×</button><p className="eyebrow">Payment detail</p><h2 id="detail-title">{selectedPayment.reference}</h2><div className="detail-hero"><div><strong>{selectedPayment.amount}</strong><span>{selectedPayment.customer}</span></div><StatusBadge label={selectedPayment.status} tone={selectedPayment.tone} /></div><dl className="quote-details"><div><dt>Payment object</dt><dd>{selectedPayment.type}</dd></div><div><dt>Settlement preference</dt><dd>{selectedPayment.settlement}</dd></div><div><dt>Settlement status</dt><dd>{selectedPayment.settlementStatus}</dd></div><div><dt>Case-safe reason</dt><dd>{selectedPayment.exception ? "Verification" : "None"}</dd></div><div><dt>Audit reference</dt><dd>AUD-{selectedPayment.reference}</dd></div></dl>{selectedPayment.exception ? <div className="exception-note"><StatusBadge label="Action required" tone="amber" /><strong>{selectedPayment.exception}</strong><p>Provide updated payer information or cancel this attempt. Raw risk indicators remain restricted.</p></div> : null}<div className="stacked-actions">{selectedPayment.status === "Paid" ? <button className="button button-secondary" onClick={() => { setPaymentDetailOpen(false); setRefundSubmitted(false); setRefundOpen(true); }} type="button">Request refund</button> : null}{selectedPayment.exception ? <button className="button button-primary" onClick={() => { setPaymentDetailOpen(false); setToast("Information request opened"); }} type="button">Provide information</button> : <button className="button button-primary" onClick={() => setPaymentDetailOpen(false)} type="button">Done</button>}</div></section></div>
      ) : null}

      {refundOpen ? (
        <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="refund-title"><button className="modal-close" aria-label="Close" onClick={() => setRefundOpen(false)} type="button">×</button>{!refundSubmitted ? <><p className="eyebrow">Refund control</p><h2 id="refund-title">Request refund</h2><p className="modal-lead">A refund is a linked money movement, not a guaranteed reversal. Source, asset, rate treatment, authority and destination must be explicit.</p><div className="form-grid"><label>Refund amount<input defaultValue={selectedPayment.amount.replace(/[^0-9.,]/g, "")} /></label><label>Refund asset<select defaultValue="Original payment asset"><option>Original payment asset</option><option>USDC</option></select></label><label>Destination<select defaultValue="Verified original sender"><option>Verified original sender</option><option>Approved withdrawal address</option></select></label><label>Rate treatment<select defaultValue="Current executable rate"><option>Current executable rate</option><option>Original accepted amount</option></select></label></div><div className="responsibility-note"><strong>Approval required</strong><p>Finance approver plus any compliance review. The request starts at <b>Under review</b>, then moves to Processing and Refunded—or Action required / Declined.</p></div><button className="button button-primary button-full" onClick={() => setRefundSubmitted(true)} type="button">Submit for review</button></> : <div className="success-state"><span>✓</span><h2>Refund under review</h2><p>REF-{selectedPayment.reference} is linked to the original payment. No funds move until authority, asset, destination and available balance are approved.</p><button className="button button-primary" onClick={() => { setRefundOpen(false); setRefundSubmitted(false); }} type="button">Done</button></div>}</section></div>
      ) : null}

      {oneTimePayoutOpen ? (
        <div className="modal-backdrop">
          <section className="modal payout-modal" role="dialog" aria-modal="true" aria-labelledby="one-time-payout-title">
            <button className="modal-close" aria-label="Close" onClick={() => { setOneTimePayoutOpen(false); resetOneTimePayout(); }} type="button">×</button>

            {oneTimePayoutStage === "recipient" ? (
              <>
                <p className="eyebrow">One-time payout · recipient library</p>
                <h2 id="one-time-payout-title">Choose a recipient</h2>
                <p className="modal-lead">Select an existing bank account or wallet. Destination details are captured and reviewed separately from the payout.</p>
                <div className="recipient-toolbar">
                  <label>
                    <span>Recipient library</span>
                    <select aria-label="Recipient library" onChange={(event) => { const recipient = recipients.find((item) => item.id === event.target.value); if (recipient) chooseRecipient(recipient); }} value={selectedRecipientId}>
                      {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.assetCode} · {recipient.status}</option>)}
                    </select>
                  </label>
                  <button className="button button-secondary" onClick={() => setOneTimePayoutStage("create-recipient")} type="button">+ Create recipient</button>
                </div>
                <div className="selected-recipient-summary recipient-library-selection">
                  <span className="recipient-avatar">{selectedRecipient.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <div><strong>{selectedRecipient.name}</strong><small>{selectedRecipient.kind} · {selectedRecipient.assetCode} · {selectedRecipient.route}</small><b>{selectedRecipient.destination}</b></div>
                  <StatusBadge label={selectedRecipient.status} tone={statusTone(selectedRecipient.status)} />
                </div>
                <div className="recipient-library-note"><StatusBadge label="Target experience" tone="blue" /><span>Ready destinations can move to payout details. Pending or incomplete recipients remain visible but cannot be sent to.</span></div>
                <button className="button button-primary button-full" disabled={selectedRecipient.status !== "Ready"} onClick={() => { chooseRecipient(selectedRecipient); setOneTimePayoutStage("details"); }} type="button">Continue with {selectedRecipient.name}</button>
              </>
            ) : null}

            {oneTimePayoutStage === "create-recipient" ? (
              <>
                <button className="modal-back" onClick={() => setOneTimePayoutStage("recipient")} type="button">← Back to recipients</button>
                <p className="eyebrow">Recipient library · no funds move</p>
                <h2 id="one-time-payout-title">Create recipient</h2>
                <p className="modal-lead">Capture the destination once. Saving starts the illustrative verification process; it does not approve or send a payout.</p>
                <div className="destination-kind-selector" role="group" aria-label="Recipient destination type">
                  {(["Bank account", "Crypto wallet"] as RecipientKind[]).map((kind) => <button aria-pressed={newRecipientKind === kind} className={newRecipientKind === kind ? "selected" : ""} key={kind} onClick={() => { setNewRecipientKind(kind); const fallback = kind === "Bank account" ? "EUR" : "USDC"; const asset = getAsset(fallback); setNewRecipientAssetCode(asset.code); if (kind === "Crypto wallet") setNewRecipientNetwork(asset.networks?.[0] ?? "Native network"); }} type="button">{kind}</button>)}
                </div>
                <div className="form-grid">
                  <label>Recipient name<input onChange={(event) => setNewRecipientName(event.target.value)} value={newRecipientName} /></label>
                  <label>Receive currency
                    <select aria-label="New recipient currency" onChange={(event) => { const asset = getAsset(event.target.value); setNewRecipientAssetCode(asset.code); if (asset.kind === "Crypto") setNewRecipientNetwork(asset.networks?.[0] ?? "Native network"); }} value={newRecipientAssetCode}>
                      <optgroup label={newRecipientKind === "Bank account" ? "Fiat currencies" : "Crypto assets"}>
                        {(newRecipientKind === "Bank account" ? fiatAssets : cryptoAssets).map((asset) => <option key={asset.code} value={asset.code}>{asset.code} · {asset.name}</option>)}
                      </optgroup>
                    </select>
                  </label>
                  {newRecipientKind === "Bank account" ? (
                    <>
                      <label>Bank country<select onChange={(event) => setNewRecipientCountry(event.target.value)} value={newRecipientCountry}><option>Germany</option><option>United Kingdom</option><option>United States</option><option>Switzerland</option><option>Sweden</option><option>Norway</option><option>Denmark</option><option>Poland</option></select></label>
                      <label>Payment rail<select onChange={(event) => setNewRecipientRail(event.target.value)} value={newRecipientRail}><option>SEPA</option><option>Faster Payments</option><option>ACH</option><option>Wire</option><option>SWIFT</option></select></label>
                      <label className="form-span-2">IBAN / account details<input onChange={(event) => setNewRecipientBankDetails(event.target.value)} value={newRecipientBankDetails} /></label>
                      <label className="form-span-2">Beneficiary and bank identifier<input defaultValue="Demo Player 4120 · DEMO-BIC" /></label>
                    </>
                  ) : (
                    <>
                      <label>Network<select aria-label="New recipient network" onChange={(event) => setNewRecipientNetwork(event.target.value)} value={newRecipientNetwork}>{getAsset(newRecipientAssetCode).networks?.map((network) => <option key={network}>{network}</option>)}</select></label>
                      <label>Wallet type<select defaultValue="External wallet"><option>External wallet</option><option>Exchange or custodian</option><option>ONE smart account</option></select></label>
                      <label className="form-span-2">Wallet address<input onChange={(event) => setNewRecipientWallet(event.target.value)} value={newRecipientWallet} /></label>
                      <label>Memo or tag (if required)<input placeholder="Optional" /></label>
                      <label>Wallet ownership<select defaultValue="Recipient verified"><option>Recipient verified</option><option>Merchant-controlled</option><option>Third-party review</option></select></label>
                    </>
                  )}
                </div>
                <div className="payout-control-note"><strong>Save only</strong><span>The recipient enters Pending verification. Compliance, ownership and destination controls remain separate from payout authorization.</span></div>
                <button className="button button-primary button-full" onClick={saveRecipient} type="button">Save recipient</button>
              </>
            ) : null}

            {oneTimePayoutStage === "details" ? (
              <>
                <button className="modal-back" onClick={() => setOneTimePayoutStage("recipient")} type="button">← Change recipient</button>
                <p className="eyebrow">One-time payout · payout details</p>
                <h2 id="one-time-payout-title">Enter payout details</h2>
                <p className="modal-lead">The recipient destination is already captured. Choose the amount and the balance that funds this payout.</p>
                <div className="selected-recipient-summary">
                  <span className="recipient-avatar">{selectedRecipient.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <div><strong>{selectedRecipient.name}</strong><small>{selectedRecipient.kind} · {selectedRecipient.assetCode} · {selectedRecipient.route}</small><b>{selectedRecipient.destination}</b></div>
                  <StatusBadge label={selectedRecipient.status} tone={statusTone(selectedRecipient.status)} />
                </div>
                <div className="form-grid">
                  <label>Recipient receives<input onChange={(event) => setPayoutAmount(event.target.value)} value={payoutAmount} /></label>
                  <label>Receive currency<input aria-label="Payout receive currency" readOnly value={`${payoutAsset.code} · ${payoutAsset.name}`} /></label>
                  <label>Fund from<select aria-label="Payout funding currency" onChange={(event) => setPayoutFundingCode(event.target.value)} value={payoutFundingCode}><AssetOptions /></select></label>
                  <label>Indicative funding amount<input readOnly value={formatAssetAmount(payoutFundingAmount, payoutFundingAsset)} /></label>
                  <label className="form-span-2">Merchant reference<input defaultValue="client-withdrawal-4028" /></label>
                </div>
                <div className="payout-control-note"><strong>Saved destination</strong><span>{selectedRecipient.route} · {selectedRecipient.destination}. Destination details are not editable during payout execution.</span></div>
                <button className="button button-primary button-full" onClick={() => setOneTimePayoutStage("review")} type="button">Review one-time payout</button>
              </>
            ) : null}

            {oneTimePayoutStage === "review" ? (
              <>
                <button className="modal-back" onClick={() => setOneTimePayoutStage("details")} type="button">← Back to payout details</button>
                <p className="eyebrow">Review one-time payout · {payoutAsset.kind}</p>
                <h2 id="one-time-payout-title">Ready to schedule</h2>
                <p className="modal-lead">The saved destination, currency and funding route passed the illustrative merchant controls.</p>
                <div className="payout-review"><div><span>Recipient</span><strong>{selectedRecipient.name}</strong></div><div><span>Destination</span><strong>{selectedRecipient.destination} · {selectedRecipient.route}</strong></div><div><span>Recipient receives</span><strong>{formatAssetAmount(parseAssetAmount(payoutAmount), payoutAsset)}</strong></div><div><span>Fund from</span><strong>{formatAssetAmount(payoutFundingAmount, payoutFundingAsset)}</strong></div><div><span>Conversion</span><strong>{payoutFundingCode === payoutAssetCode ? "Not required" : `${payoutFundingCode} → ${payoutAssetCode} · indicative`}</strong></div><div><span>Reference</span><strong>client-withdrawal-4028</strong></div></div>
                <div className="payout-validation-row"><div><StatusBadge label="Ready" tone="green" /><span>Saved recipient</span></div><div><StatusBadge label="Available" tone="green" /><span>Funding balance</span></div><div><StatusBadge label="Within policy" tone="blue" /><span>Merchant approval rule</span></div></div>
                <button className="button button-primary button-full" onClick={() => setOneTimePayoutStage("scheduled")} type="button">Confirm and schedule payout</button>
              </>
            ) : null}

            {oneTimePayoutStage === "scheduled" ? (
              <div className="success-state"><span>✓</span><h2 id="one-time-payout-title">One-time payout scheduled</h2><p><strong>OUT-4028</strong> will deliver <strong>{formatAssetAmount(parseAssetAmount(payoutAmount), payoutAsset)}</strong> to <strong>{selectedRecipient.name}</strong> at the saved {selectedRecipient.kind.toLowerCase()} ending <strong>{selectedRecipient.destination}</strong>. Conversion and transfer evidence remain attached to the payout.</p><button className="button button-primary" onClick={() => { setOneTimePayoutOpen(false); resetOneTimePayout(); setView("payouts"); }} type="button">View payout activity</button></div>
            ) : null}
          </section>
        </div>
      ) : null}

      {batchOpen ? (
        <div className="modal-backdrop"><section className="modal batch-modal" role="dialog" aria-modal="true" aria-labelledby="batch-title"><button className="modal-close" aria-label="Close" onClick={() => { setBatchOpen(false); setBatchStep(0); }} type="button">×</button>{batchStep === 0 ? <><p className="eyebrow">Day 60 candidate · mixed-currency batch</p><h2 id="batch-title">Create a payout batch</h2><p className="modal-lead">Load bank and wallet recipients in one file, then choose any approved funding currency.</p><div className="upload-zone"><span>CSV</span><div><strong>demo-player-withdrawals.csv</strong><p>42 fictional recipients · fiat and crypto destinations</p></div><button className="button button-secondary" onClick={() => setToast("Mixed-currency demo sample loaded")} type="button">Load sample</button></div><div className="form-grid batch-funding-select"><label className="form-span-2">Fund batch from<select aria-label="Batch funding currency" onChange={(event) => setBatchFundingCode(event.target.value)} value={batchFundingCode}><AssetOptions /></select></label></div><div className="batch-composition"><div><span>Bank destinations</span><strong>21</strong><small>EUR · GBP · USD · CHF · SEK</small></div><div><span>Wallet destinations</span><strong>21</strong><small>USDC · USDT · BTC · ETH · SOL</small></div><div><span>Funding balance</span><strong>{getAsset(batchFundingCode).balance}</strong><small>Conversions shown per recipient</small></div></div><button className="button button-primary button-full" onClick={() => setBatchStep(1)} type="button">Validate mixed-currency batch</button></> : batchStep === 1 ? <><p className="eyebrow">Mixed-currency validation</p><h2 id="batch-title">41 ready · 1 needs attention</h2><p className="modal-lead">Bank fields and wallet fields validate against the currency, rail, asset and network on each row.</p><div className="validation-summary"><div><StatusBadge label="Ready" tone="green" /><strong>41</strong><small>20 bank · 21 wallet destinations valid</small></div><div><StatusBadge label="Needs attention" tone="amber" /><strong>1</strong><small>GBP bank row is missing a sort code</small></div></div><div className="table-wrap"><table className="compact-table mixed-batch-table"><thead><tr><th>Recipient</th><th>Receives</th><th>Destination</th><th>Funding route</th><th>Status</th></tr></thead><tbody><tr><td><strong>demo-001</strong><small>Demo Player 1042</small></td><td>€25,000.00</td><td>SEPA · DEMO…1042</td><td>{batchFundingCode} → EUR</td><td><StatusBadge label="Ready" tone="green" /></td></tr><tr><td><strong>demo-002</strong><small>Demo Player 2088</small></td><td>8,500 USDC</td><td>Polygon · DEMO…2088</td><td>{batchFundingCode} → USDC</td><td><StatusBadge label="Ready" tone="green" /></td></tr><tr><td><strong>demo-042</strong><small>Demo Player 3091</small></td><td>£1,250.00</td><td>Faster Payments · incomplete</td><td>{batchFundingCode} → GBP</td><td><StatusBadge label="Needs attention" tone="amber" /></td></tr></tbody></table></div><button className="button button-primary button-full" onClick={() => setBatchStep(2)} type="button">Submit valid items for approval</button></> : <div className="success-state"><span>✓</span><h2>Approval required</h2><p>BAT-0184 has 41 eligible fiat and crypto recipient items funded from <strong>{batchFundingCode}</strong>. A second authorized merchant user must approve before funds are reserved, converted or sent.</p><button className="button button-primary" onClick={() => { setBatchOpen(false); setBatchStep(0); setView("payouts"); }} type="button">View payout activity</button></div>}</section></div>
      ) : null}

      {profileOpen ? (
        <div className="modal-backdrop"><section className="modal scope-modal" role="dialog" aria-modal="true" aria-labelledby="scope-title"><button className="modal-close" aria-label="Close" onClick={() => setProfileOpen(false)} type="button">×</button><p className="eyebrow">Gateway V3 delivery scope</p><h2 id="scope-title">What the customer can see at each gate</h2><p className="modal-lead">Day 30 is the agreed merchant mental model plus architecture/control decisions. Day 60 is the approved sellable sandbox MVP. Day 90 is pilot hardening, timetable and ONE-owned handoff—not a blanket production promise.</p><div className="customer-tabs" role="tablist" aria-label="Customer type">{(["iGaming operator", "Prop firm", "PSP"] as CustomerType[]).map((type) => <button aria-selected={customerType === type} className={customerType === type ? "selected" : ""} key={type} onClick={() => setCustomerType(type)} role="tab" type="button">{type}</button>)}</div><div className="phase-grid">{customerPhaseMatrix[customerType].map((phase) => <article key={phase.phase}><StatusBadge label={phase.phase} tone={phase.tone} /><h3>{phase.title}</h3><ul>{phase.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div><div className="scope-dependencies"><strong>Dependencies that control timing</strong><span>Provider access and fees</span><span>Supported routes</span><span>Engineering capacity</span><span>Architecture approval</span><span>Compliance / Legal / Banking / Trading inputs</span></div><div className="scope-footnote"><StatusBadge label="Public demo boundary" tone="gray" /><p>All routes, balances, recipients, references and statuses are fictional. Availability depends on approved entity, jurisdiction, provider and control decisions.</p></div></section></div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
