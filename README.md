# ONE Gateway V3 discussion prototype

Interactive, mock-data-only prototype for discussing the target ONE Gateway V3 merchant experience.

Live demo: https://bryfeng.github.io/one-gateway-v3-demo/

## iGaming-first walkthrough

1. Open the EUR, GBP and USD accounts to view and copy their fictional bank details.
2. Open the main USDC stablecoin wallet, Bitcoin wallet and Solana wallet to inspect each network-specific demo receiving address.
3. Create a payment link, invoice, hosted checkout or API payment request.
4. Preview the payer journey and distinguish payment acceptance from settlement.
5. Exchange and settle into an approved fiat or stablecoin balance.
6. Create one-time payouts from saved recipients or validate a controlled payout batch.
7. Review exceptions, settlement evidence and reconciliation exports.

## Prototype boundary

- All merchants, recipients, balances, references, destinations, quotes and statuses are fictional.
- Every copy control returns an intentionally invalid `DEMO-` identifier; it is safe only as interface data and must never be used as a real destination.
- No wallet is provisioned and no keys, seed phrases, signing capability, custody or funds exist behind the wallet screens.
- No live wallet, bank, payment, payout, exchange or settlement integration is connected.
- Do not send funds to anything shown in the prototype.
- The UI represents a target discussion model, not a statement that every illustrated route is currently available or commercially committed.
- Availability depends on approved entity, jurisdiction, asset, network, rail and control decisions.

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
