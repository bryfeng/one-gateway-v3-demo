# ONE Gateway V3 discussion prototype

Interactive prototype for discussing the target ONE Gateway V3 merchant experience. The product screens remain fictional; Controls & evidence now includes two separately labelled, optional public-testnet proof paths.

Live demo: https://bryfeng.github.io/one-gateway-v3-demo/

## iGaming-first walkthrough

1. Open the EUR, GBP and USD accounts to view and copy their fictional bank details.
2. Open the main USDC stablecoin wallet, Bitcoin wallet and Solana wallet to inspect each network-specific demo receiving address.
3. Create a payment link, invoice, hosted checkout or API payment request.
4. Preview the payer journey, use Dynamic to connect and prove control of an injected EVM wallet, and distinguish that authentication from the illustrative quote and payment stages.
5. Exchange and settle into an approved fiat or stablecoin balance.
6. Create one-time payouts from saved recipients or validate a controlled payout batch.
7. Review exceptions, settlement evidence and reconciliation exports.
8. Open **Controls & evidence** for the custody/control matrix, screening decision rights, the merchant-elected service boundary, the Dynamic wallet client, the credentialed Flow test track and the separate native-ETH payer-signature harness.

## Prototype boundary

- All merchants, recipients, balances, references, destinations, quotes and statuses are fictional.
- Every copy control returns an intentionally invalid `DEMO-` identifier; it is safe only as interface data and must never be used as a real destination.
- No wallet is provisioned and no keys, seed phrases, signing capability, custody or funds exist behind the fictional merchant wallet screens.
- The optional Controls & evidence harness can connect an injected EIP-1193 wallet and, only after separate connect, network and send actions, request a user-approved native test-ETH transaction on Base Sepolia. Its destination and amount exist only as runtime input; nothing is auto-sent.
- Dynamic environment `3608a494-ff5c-4cbc-a425-ddc382e4a90a` is configured in the public client. The payer wallet path uses Dynamic’s current JavaScript SDK to discover an injected EVM wallet and request an ownership signature. WalletConnect and embedded-wallet/WaaS extensions are not registered.
- Dynamic wallet authentication by itself does not create a payment Flow, quote, transaction or settlement. Everything after wallet selection in the payer-facing preview remains illustrative and cannot move funds.
- A successful receipt in the native-ETH harness proves only payer signature and public-testnet funds movement. That transfer does not use or prove Dynamic Flow conversion, screening, generated-address custody, refunds or ETH-to-USDC settlement.
- The optional credentialed Flow harness is a different path: one test USDC from a freshly verified payer wallet to a distinct merchant-controlled address on Base Sepolia. It can create a real Dynamic Flow, wait for its risk decision, quote, request the payer’s wallet approval and record source and settlement hashes. Its create backend is live but remains inert until a presenter supplies the meeting-only access key and explicitly advances the steps.
- Dynamic documents testnet Flow support as wallet-source, same-token only, without swaps or bridges. The harness therefore uses Base Sepolia USDC → USDC with swaps disabled; it does not claim to prove the proposed mainnet conversion route.
- The wallet-source Flow does not inherently use a Flow-generated deposit address. Deposit-address source mode is a separate, unexercised custody path.
- No live bank, mainnet payment, payout, exchange or settlement integration is connected.
- Do not send real assets or mainnet funds through the prototype. Use only Base Sepolia test ETH in the native harness and test USDC in the Dynamic Flow harness.
- The UI represents a target discussion model, not a statement that every illustrated route is currently available or commercially committed.
- The proposed service-tier election makes transaction-specific screening a condition of requesting Gateway services. The alternative is direct payer-to-merchant self-custody checkout only, with no ONE/Dynamic routing, conversion, platform balance, settlement, payout, off-ramp or ONE reconciliation. Separate receiving context or transaction-level provenance prevents a later tier change from making an unscreened balance eligible. The election does not waive mandatory legal or contractual controls or give ONE control over assets in a merchant-controlled wallet.
- Availability depends on approved entity, jurisdiction, asset, network, rail and control decisions.

## Dynamic boundary and operational setup

- The public environment ID is browser configuration, not a secret. As verified on 3 September 2026, Flow is enabled for environment `3608a494-ff5c-4cbc-a425-ddc382e4a90a` and the API-token screen exposes `flow.write`.
- A Dynamic API token named `ONE Gateway Base Sepolia demo` is scoped only to `flow.write` and stored as an encrypted Cloudflare Worker secret. It is not present in this Vite app, GitHub or GitHub Pages.
- Base Sepolia (chain ID `84532`) is now enabled alongside Ethereum mainnet in the supplied Dynamic sandbox.
- The included Cloudflare Worker is deliberately not a generic Dynamic proxy. It accepts only a ONE payment-intent ID, then fixes the amount (`1.00 USD`), mode (`payment`), expiry (15 minutes), Base Sepolia USDC contract, same-token/no-swap policy and merchant destination on the server. It does not accept or claim a payer address; the evidence view reads the screened source back from Dynamic after wallet attachment and refuses quote or signing unless that address still matches the freshly proved wallet. It also refuses the route when the attached payer matches the merchant destination.
- The create backend returns only the `flowId` to the page. When the browser attaches the wallet, Dynamic’s SDK receives and stores the one-Flow session capability for quote, prepare and broadcast calls; the UI never reads, renders or logs that token.
- The browser stores the ONE payment-intent ID and Dynamic Flow ID as one local evidence-linkage record so a refresh cannot silently relabel an existing Flow. Clearing an unfinished attempt is explicit and does not claim to cancel the provider Flow or revoke an earlier token approval.
- If signing is interrupted, the harness first refreshes Dynamic state. A Flow still in `signing` with no recorded payment transaction can request a replacement quote before trying again; a broadcast Flow is polled instead of re-signed.
- The browser does not declare settlement complete when the source transaction confirms. It continues polling until `settlementState` reaches `completed` or `failed`.
- A production backend would additionally persist the payment/provider reference graph, verify webhooks and support operational recovery. This meeting harness keeps the concrete proof path narrow.
- The environment currently requires email as a profile field. A new wallet-authenticated user may therefore need email/OTP onboarding unless that sandbox requirement is changed before the meeting.
- The deployed create backend is `https://one-gateway-flow-demo.bryfeng.workers.dev`; its public health response confirms the fixed 1.00-USDC Base Sepolia route without revealing the merchant address or credentials. The Dynamic token, meeting access key and distinct merchant test address are encrypted Worker secrets. Before the meeting payment, verify external-wallet sign-in, fund the payer with Base Sepolia test USDC and enter the meeting key at runtime.
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
- `MERCHANT_BASE_SEPOLIA_ADDRESS`: a merchant-controlled test address distinct from the payer.

Set `VITE_FLOW_API_BASE_URL` to the local or deployed Worker URL.

Verification:

```bash
npm test
```

Verification compiles the static site, type-checks and dry-runs the Worker, and exercises the Worker’s fixed-route/authentication boundaries. Every push to `main` is then verified and deployed to GitHub Pages by the included workflow. Worker deployment remains a separate, manual operation so its secrets never enter GitHub.

Copyright reserved. No open-source license is granted.
