# ONE Gateway V3: API review and weekend demo

Reviewed and built locally on 19 September 2026. This is a working implementation note for Bryan and Mark, not an agreed production API contract.

**20 September update:** Begin the next mock revision with the [API specification outline](2026-09-20-api-spec-outline.md). It inventories existing ONE calls, documents Dynamic Business Accounts and Flow, and proposes the business contract before further implementation. The build described below remains an implementation record; its routes do not determine the agreed specification.

## What Mark needs

The [17 September Gateway sync](granola://meeting/44ff71cf-8ff9-45c3-bc89-018232fa55a9) records Bryan's commitment to add a separate checkout and mock APIs showing the merchant interaction cycle by Monday, 21 September. Updated demo links, collateral and a short write-up were due early the following week. Mark would use these to prepare Jira epics and stories for joint review. Smart accounts remain later scope.

The meeting summary and participant metadata were retrieved directly. Full transcript access was unavailable on the connected Granola tier. The meeting's contract/compliance remarks are participant context, not independent verification of signature or approval. Reviewing API docs is Bryan's current instruction; it was not an explicit action in the retrieved notes.

## What the sources establish

| Source | Verified observation | Consequence for this build |
| --- | --- | --- |
| [ONE.io public API](https://docs.one.io/) | OpenAPI 3.0.4, API v1.0; 25 operations across accounts, authentication, crypto custody withdrawals, exchange rates, organisation, payments, payout deals and transactions. | Reuse published account response fields. Inventory every operation before proposing new Gateway routes. |
| ONE supplied `Product-ONE Gateway API-070726-202144.pdf`, eight pages, draft | Describes desired invoice, deposit-address, balance, transaction, withdrawal, P2P, payout, refund and webhook capabilities. Contains no HTTP schemas for a checkout API and older operational claims. | Treat it as scope context. Do not equate desired capabilities with deployed endpoints. |
| [Dynamic Flow JavaScript guide](https://www.dynamic.xyz/docs/overview/fireblocks-flow-js-sdk) and [HTTP guide](https://www.dynamic.xyz/docs/overview/fireblocks-flow-api) | Server creates the Flow; client attaches source, screens, quotes and signs. Execution, risk and settlement are separate axes. Testnets support wallet-source, same-token transfers, without swaps or bridges. | Keep the existing fixed 1.00 USDC Base Sepolia harness. A source confirmation alone does not settle the order. |
| Existing local Flow code and [Worker health](https://one-gateway-flow-demo.bryfeng.workers.dev/health) | Create-and-verify backend reports ready for 1.00 USDC / chain 84532; browser harness reaches Ready. | Reuse the existing real testnet proof path. Health is not transaction or settlement evidence. |

The public ONE API includes `GET /api/v1/accounts?accountType=Crypto` with `cryptoAddresses`, whitelisted withdrawal-address CRUD, and crypto withdrawal submission. The older draft's statement that the API has no crypto functionality is stale relative to the current published contract. The published API still does not expose invoice creation, hosted Gateway checkout, Flow attachment, or Gateway-specific payment-intent/webhook contracts. This is a documentation finding, not proof that internal endpoints do not exist.

The complete published operation catalogue is in `one-api-operation-inventory-2026-09-19.json`.

## Existing ONE API or mocks?

Use local mocks for the merchant rehearsal now. The published sandbox is `https://integration-api.uk-sbx-1.credis.tech`. Its documented access requires an administrator JWT and encrypted `X-Partner-Authorization` customer context. No ONE sandbox credentials or customer context were verified in this task, and no authenticated ONE request was made. Do not borrow the Dynamic credential or embed ONE credentials in the browser.

Two documentation questions should be settled with ONE's backend team before a real adapter:

- `GetAccounts` describes optional selectors/default fiat behavior, but the generated schema marks account type, IBAN, account number and sort code all required. This mock follows the descriptive optional-filter behavior and is not proof of sandbox acceptance.
- Confirm the partner-auth cipher precisely: prose names AES-GCM-SIV while the example/helper wording refers to AES-GCM. Also confirm status enums, callback signing, retry/order guarantees and correlation IDs against the actual sandbox.

## The concrete path built

Merchant creates a 1.00 USD request → server returns a unique request and checkout URL → payer opens a separate page → presenter simulates source confirmation → merchant remains settlement-pending → presenter confirms settlement → merchant shows a simulated receipt and local event delivery.

Funds stop at a fictional merchant self-custody wallet. The account mock's EUR balance stays unchanged. Conversion, fiat credit and off-ramp are separate future merchant instructions. No smart-account provisioning is implied.

Three boundaries are visible in the UI and code:

| Contract | Implemented locally | Status |
| --- | --- | --- |
| `GET /api/v1/accounts`, `GET /api/v1/accounts/{id}` | One fictional fiat account, published field shape, optional selectors, unknown-ID errors | Mock of documented ONE operations; no complete API emulator |
| `POST /gateway/v3/payment-intents`; `GET` collection and item | Fixed amount/route, unique checkout URL, idempotent create with conflict detection, persistent state across browser refreshes | Proposed Gateway contract for review, not a published ONE endpoint |
| `POST /demo/payment-intents/{id}/actions`; `GET /demo/events`; `POST /demo/events/{id}/replay` | Source-confirmed, settled, blocked, expired and failed outcomes; local event receipt and duplicate suppression | Rehearsal-only controls, not production API or provider webhook ingestion |

All browser mock calls go through `/demo-api` to a loopback-only local server. Server state is in memory; restarting it clears requests. Maximum 100 requests per run. Unknown operations fail rather than pretending to succeed. Writes require JSON and explicit mock mode. This is not a production authentication mechanism.

Mock event names (`payment.created`, `payment.processing`, `payment.settled`, etc.) are proposed merchant events. Dynamic's actual event families include `flow.execution.updated`, `flow.risk.updated` and `flow.settlement.updated`; their envelope is different. The local delivery demo does not prove callback-signature verification, networking, retries, ordering, durability or reconciliation against ONE's ledger.

## Relationship to the real Flow harness

The Merchant cycle page links to the existing Flow testnet demo. That harness retains its wallet ownership proof, screening, server-authoritative destination verification and explicit payer-signing boundary. The new mock checkout does not call Dynamic, use a real receiving address, sign, or submit funds. It does not automatically reconcile an actual Flow into the mock merchant record.

The next real integration is narrow: persist the ONE request ↔ Flow ID mapping in a backend, create the Flow from that immutable request, expose its checkout, and update merchant status from verified provider evidence. Confirm sandbox credentials and ONE's internal Gateway schemas before replacing documented account mocks. No general provider abstraction is needed to prove that path.

## Run and demonstrate

From this repository, start `npm run demo:api` and, in a second terminal, `VITE_FLOW_API_BASE_URL=https://one-gateway-flow-demo.bryfeng.workers.dev npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.

Open `http://127.0.0.1:5173/?view=merchant-cycle`.

1. Create a checkout and open it in another tab.
2. Simulate the payment. Keep both pages visible: source is confirmed, settlement is pending.
3. Confirm demo settlement. The merchant sees the receipt without a ONE fiat-account credit.
4. Replay an event to show duplicate suppression.
5. Create another request to show screening block, expiry or settlement failure.
6. Use the separate Flow testnet link when demonstrating the existing credentialed harness. A funded wallet and presenter key are still required to execute that path.

This new walkthrough is local-only. The current GitHub Pages link has not been updated and cannot host this Node mock backend as static files. Public hosting or provider transactions were not performed.

## Validation and handoff

The complete existing test suite plus five new HTTP behavior tests passed (30 total), including the site build, Worker type checks and deployment dry run. Browser checks covered actual create requests, separate checkout tabs, pending-versus-settled behavior, both pages surviving refresh, merchant polling, event replay, unknown-request errors, mobile checkout width and existing Flow harness readiness. No browser runtime errors occurred. Desktop and mobile screenshots were inspected.

For Mark's stories, the concrete acceptance criteria are: one idempotent request; a separate payer URL; independent source and settlement states; immutable route/destination verification before signing in the real path; one merchant receipt per event; retained failed-payment evidence; and a separate instruction before ONE conversion or credit. Remaining work is the actual provider-to-merchant reconciliation path and the agreed ONE sandbox adapter, followed by a reviewed shareable demo/collateral package. Nothing has been sent to Mark.
