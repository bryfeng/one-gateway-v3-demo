# ONE Gateway V3 discussion prototype

Interactive prototype for discussing the target ONE Gateway V3 merchant experience. The product screens remain fictional; the Flow demo is a focused, optional public-testnet proof path.

Live demo: https://bryfeng.github.io/one-gateway-v3-demo/

## Local ONE → Flow address test

The [local API sequence](docs/2026-09-23-local-one-flow.md) reads the receiving address from ONE's sandbox and passes it directly to Flow. It needs no HTTP server, Cloudflare deployment, or payer address. It then reads the server-side Flow to verify the destination. This test uses Base Sepolia test USDC; the ONE account supplies the EVM address, not a claim of supported ONE ledger credit. Current Flow testnet docs require a swap or bridge, so this script allows routing; the older browser harness below still has swaps disabled.

## API specification first — 20 September 2026

Start with the [four-section HTML brief](../one-api-brief/dist/one-gateway-api-brief.html) for a compact business view with expandable API details.

The [API specification outline](docs/2026-09-20-api-spec-outline.md) is the starting point for the next mock revision. It explains all 25 published ONE operations in technical and business terms, maps Dynamic Business Accounts and Fireblocks Flow, and separates proposed Gateway contracts from existing provider calls. Current mock routes remain draft examples. Dynamic Business Accounts are documented as early access; quorum policies are marked coming soon. No additional implementation was made as part of that specification review.

## Local merchant cycle added 19 September 2026

The local **Merchant cycle** view adds working mock HTTP APIs and a separate payer checkout. It follows the 17 September meeting with Mark: create a request, open checkout, distinguish source confirmation from settlement, and inspect merchant event receipts. Read the [API review and demo handoff](docs/2026-09-19-api-review-and-demo.md) for sources, the existing-versus-proposed contract boundary, acceptance criteria and remaining integration work.

Start `npm run demo:api` in one terminal and `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` in another, then open `http://127.0.0.1:5173/?view=merchant-cycle`. To enable the existing Flow harness link locally, supply `VITE_FLOW_API_BASE_URL=https://one-gateway-flow-demo.bryfeng.workers.dev` when starting Vite.

The API listens only on `127.0.0.1:8790`; Vite forwards `/demo-api` to it. State survives browser refreshes and is shared across tabs, but resets when the API process restarts. `npm run test:demo` checks the mock's HTTP behavior. The new checkout and merchant event receipts are simulations; they do not call Dynamic or ONE, reconcile a real Flow, or move funds. The real Flow testnet harness remains a separate proof path. This addition has not been deployed to the public demo; GitHub Pages alone cannot run its Node backend.

The mock reuses ONE's published account response shape for two read endpoints. `/gateway/v3/*` is a proposed Gateway contract; `/demo/*` is rehearsal control. Neither is represented as an existing ONE endpoint. Source confirmation does not mark settlement complete, and a merchant self-custody receipt does not credit a ONE fiat balance.

## iGaming-first walkthrough

1. Open the EUR, GBP and USD accounts to view and copy their fictional bank details.
2. Open the main USDC stablecoin wallet, Bitcoin wallet and Solana wallet to inspect each network-specific demo receiving address.
3. Create a payment link, invoice, hosted checkout or API payment request.
4. Preview the payer journey, use Dynamic to connect and prove control of an injected EVM wallet, and distinguish that authentication from the illustrative quote and payment stages.
5. Exchange and settle into an approved fiat or stablecoin balance.
6. Create one-time payouts from saved recipients or validate a controlled payout batch.
7. Review exceptions, settlement evidence and reconciliation exports.
8. Open **Flow demo**, connect and verify a payer wallet, enter the settlement destination, and run the credentialed Fireblocks Flow test path.

## Prototype boundary

- All merchants, recipients, balances, references, destinations, quotes and statuses are fictional.
- Every copy control returns an intentionally invalid `DEMO-` identifier; it is safe only as interface data and must never be used as a real destination.
- No wallet is provisioned and no keys, seed phrases, signing capability, custody or funds exist behind the fictional merchant wallet screens.
- Dynamic environment `3608a494-ff5c-4cbc-a425-ddc382e4a90a` is configured in the public client. The payer wallet path uses Dynamic’s current JavaScript SDK to discover an injected EVM wallet and request an ownership signature. WalletConnect and embedded-wallet/WaaS extensions are not registered.
- Dynamic wallet authentication by itself does not create a payment Flow, quote, transaction or settlement. The separate Flow launcher explicitly creates the Flow and keeps wallet payment approval as a later action.
- Once Dynamic enables Fireblocks Flow for this environment, the credentialed harness is designed to send one test USDC from a freshly verified payer wallet to the EVM settlement address entered at runtime. It can then create a real Dynamic Flow, wait for its risk decision, quote, request the payer’s wallet approval and record source and settlement hashes. The destination is locked in the local attempt once the Flow is created.
- Dynamic documents testnet Flow support as wallet-source, same-token only, without swaps or bridges. The harness therefore uses Base Sepolia USDC → USDC with swaps disabled; it does not claim to prove the proposed mainnet conversion route.
- The wallet-source Flow does not inherently use a Flow-generated deposit address. Deposit-address source mode is a separate, unexercised custody path.
- No live bank, mainnet payment, payout, exchange or settlement integration is connected.
- Do not send real assets or mainnet funds through the prototype. Use only Base Sepolia test USDC in the Dynamic Flow harness.
- The UI represents a target discussion model, not a statement that every illustrated route is currently available or commercially committed.
- The proposed service-tier election makes transaction-specific screening a condition of requesting Gateway services. The alternative is direct payer-to-merchant self-custody checkout only, with no ONE/Dynamic routing, conversion, platform balance, settlement, payout, off-ramp or ONE reconciliation. Separate receiving context or transaction-level provenance prevents a later tier change from making an unscreened balance eligible. The election does not waive mandatory legal or contractual controls or give ONE control over assets in a merchant-controlled wallet.
- Availability depends on approved entity, jurisdiction, asset, network, rail and control decisions.

## Dynamic boundary and operational setup

- The public environment ID is browser configuration, not a secret. As verified through live create requests on 6 September 2026, Fireblocks Flow is enabled and accepts Flow creation for environment `3608a494-ff5c-4cbc-a425-ddc382e4a90a`.
- A Dynamic API token named `ONE Gateway Base Sepolia demo` was created for the `flow.write` scope and is stored as an encrypted Cloudflare Worker secret. It is not present in this Vite app, GitHub or GitHub Pages. Successful Flow creation confirms that the deployed token is accepted for this operation; Dynamic’s dashboard does not expose existing-token scopes for re-inspection.
- Base Sepolia (chain ID `84532`) is now enabled alongside Ethereum mainnet in the supplied Dynamic sandbox.
- The included Cloudflare Worker is deliberately not a generic Dynamic proxy. It accepts only a ONE payment-intent ID and an EVM settlement destination, validates and normalizes that address, then fixes the amount (`1.00 USD`), mode (`payment`), expiry (15 minutes), Base Sepolia USDC contract and same-token/no-swap policy. It does not accept or claim a payer address. Dynamic's browser responses do not expose the authoritative destination configuration, and a quote-time `toAddress` is not treated as the merchant wallet. The page may attach, screen and quote without moving funds, then requires the credentialed Worker to re-read Dynamic's immutable server-only destination configuration and confirm the exact Flow ID, ONE intent, fixed route and merchant destination before signing is available.
- The create backend returns only the `flowId` to the page. When the browser attaches the wallet, Dynamic’s SDK receives and stores the one-Flow session capability for quote, prepare and broadcast calls; the UI never reads, renders or logs that token.
- The browser stores the ONE payment-intent ID, Dynamic Flow ID and locked settlement destination as one local attempt record so a refresh cannot silently relabel an existing Flow. Clearing an unfinished attempt is explicit and does not claim to cancel the provider Flow or revoke an earlier token approval.
- If signing is interrupted, the harness first refreshes Dynamic state. A Flow still in `signing` with no recorded payment transaction can request a replacement quote before trying again; a broadcast Flow is polled instead of re-signed.
- The browser does not declare settlement complete when the source transaction confirms. It continues polling until `settlementState` reaches `completed` or `failed`.
- A production backend would additionally persist the payment/provider reference graph, verify webhooks and support operational recovery. This meeting harness keeps the concrete proof path narrow.
- The environment currently requires email as a profile field. A new wallet-authenticated user may therefore need email/OTP onboarding unless that sandbox requirement is changed before the meeting.
- The deployed create-and-verify backend is `https://one-gateway-flow-demo.bryfeng.workers.dev`; its public health response confirms the fixed 1.00-USDC Base Sepolia route without revealing credentials. The Dynamic token and meeting access key are encrypted Worker secrets; the settlement address is ordinary runtime input. Before the meeting payment, confirm per-environment Flow enablement and `flow.write`, then verify external-wallet sign-in, fund the payer with Base Sepolia test USDC, enter the destination and paste the meeting key.
- Official references: [external EVM extensions](https://www.dynamic.xyz/docs/javascript/reference/evm/adding-evm-extensions), [external-wallet connection](https://www.dynamic.xyz/docs/javascript/building-ui/connecting-external-wallets), and [Flow JavaScript guide](https://www.dynamic.xyz/docs/overview/fireblocks-flow-js-sdk).

## Local use

For the meeting-safe evidence view, open `/?view=controls#dynamic-flow-demo`. The selected section stays in the URL so it can be bookmarked or shared directly.

Requires Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

The static interface works without the Flow backend. To exercise the credentialed track locally, copy the two examples without committing the populated files:

```bash
cp .env.example .env.local
cp flow-worker/.dev.vars.example flow-worker/.dev.vars
npm run worker:dev
```

Required private Worker values:

- `DYNAMIC_API_TOKEN`: a Dynamic token scoped only to `flow.write`.
- `ONE_DEMO_ACCESS_KEY`: a meeting-only operator gate entered at runtime and never stored by the page.

Set `VITE_FLOW_API_BASE_URL` to the local or deployed Worker URL.

Verification:

```bash
npm test
```

Verification compiles the static site, type-checks and dry-runs the Worker, and exercises the Worker’s fixed-route/authentication boundaries. Every push to `main` is then verified and deployed to GitHub Pages by the included workflow. Worker deployment remains a separate, manual operation so its secrets never enter GitHub.

Copyright reserved. No open-source license is granted.
