# ONE Gateway V3 discussion prototype

Interactive, mock-data-only prototype for discussing the target ONE Gateway V3 merchant experience.

Live demo: https://bryfeng.github.io/one-gateway-v3-demo/

## iGaming-first walkthrough

1. Open the EUR, GBP and USD accounts to view and copy their fictional bank details.
2. Open the main USDC stablecoin wallet, Bitcoin wallet and Solana wallet to inspect each network-specific demo receiving address.
3. Create a payment link, invoice, hosted checkout or API payment request.
4. Preview the payer journey, use Dynamic to connect and prove control of an injected EVM wallet, and distinguish that authentication from the illustrative quote and payment stages.
5. Exchange and settle into an approved fiat or stablecoin balance.
6. Create one-time payouts from saved recipients or validate a controlled payout batch.
7. Review exceptions, settlement evidence and reconciliation exports.
8. Open **Controls & evidence** for the custody/control matrix, screening decision rights, the merchant-elected service boundary, the live Dynamic client boundary, the separate unexecuted Flow route and the optional Base Sepolia payer-signature harness.

## Prototype boundary

- All merchants, recipients, balances, references, destinations, quotes and statuses are fictional.
- Every copy control returns an intentionally invalid `DEMO-` identifier; it is safe only as interface data and must never be used as a real destination.
- No wallet is provisioned and no keys, seed phrases, signing capability, custody or funds exist behind the fictional merchant wallet screens.
- The optional Controls & evidence harness can connect an injected EIP-1193 wallet and, only after separate connect, network and send actions, request a user-approved native test-ETH transaction on Base Sepolia. Its destination and amount exist only as runtime input; nothing is auto-sent.
- Dynamic environment `3608a494-ff5c-4cbc-a425-ddc382e4a90a` is configured in the public client. The payer wallet path uses Dynamic’s current JavaScript SDK to discover an injected EVM wallet and request an ownership signature. WalletConnect and embedded-wallet/WaaS extensions are not registered.
- Dynamic wallet authentication does not create a payment Flow, quote, transaction or settlement. Everything after wallet selection in the payer preview remains illustrative and cannot move funds.
- A successful Base Sepolia receipt proves only payer signature and public-testnet funds movement. The transfer itself does not use or prove Dynamic Flow conversion, screening, generated-address custody, refunds or ETH-to-USDC settlement.
- Dynamic documents testnet Flow support as wallet-source, same-token only, without swaps or bridges. Base Sepolia therefore cannot prove the proposed ETH-to-USDC route. The Dynamic Base mainnet ETH-to-USDC track remains unexecuted, and any mainnet run requires separate explicit authorization.
- No live bank, mainnet payment, payout, exchange or settlement integration is connected.
- Do not send real assets or mainnet funds through the prototype. If using the optional harness, use only Base Sepolia test ETH and a runtime destination you control.
- The UI represents a target discussion model, not a statement that every illustrated route is currently available or commercially committed.
- The proposed service-tier election makes transaction-specific screening a condition of requesting Gateway services. The alternative is direct payer-to-merchant self-custody checkout only, with no ONE/Dynamic routing, conversion, platform balance, settlement, payout, off-ramp or ONE reconciliation. Separate receiving context or transaction-level provenance prevents a later tier change from making an unscreened balance eligible. The election does not waive mandatory legal or contractual controls or give ONE control over assets in a merchant-controlled wallet.
- Availability depends on approved entity, jurisdiction, asset, network, rail and control decisions.

## Dynamic boundary and remaining setup

- The public environment ID is browser configuration, not a secret. Dynamic Flow creation still requires a backend-held API token with `flow.write`; that token must never be added to this Vite app, GitHub, or GitHub Pages.
- A production Flow backend must create and persist the payment intent and provider IDs, return the `flowId` to the browser, verify webhooks, and wait for final settlement. A source-confirmed state is not final settlement.
- As checked on 2 September 2026, the supplied Dynamic sandbox publicly exposes Ethereum mainnet but not Base Sepolia. Flow entitlement and a server Flow credential are still unconfirmed.
- The environment currently requires email as a profile field. A new wallet-authenticated user may therefore need email/OTP onboarding unless that sandbox requirement is changed before the meeting.
- The development and deployed origins already pass the environment’s public CORS check. The remaining dashboard checks are external-wallet sign-in, the intended network list, and Flow enablement.
- Official references: [external EVM extensions](https://www.dynamic.xyz/docs/javascript/reference/evm/adding-evm-extensions), [external-wallet connection](https://www.dynamic.xyz/docs/javascript/building-ui/connecting-external-wallets), and [Flow JavaScript guide](https://www.dynamic.xyz/docs/overview/fireblocks-flow-js-sdk).

## Local use

Requires Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

Verification:

```bash
npm test
```

Every push to `main` is verified and deployed to GitHub Pages by the included workflow.

Copyright reserved. No open-source license is granted.
