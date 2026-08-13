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
