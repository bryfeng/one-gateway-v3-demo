import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
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
  ]) {
    assert.match(appSource, new RegExp(label));
  }
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
