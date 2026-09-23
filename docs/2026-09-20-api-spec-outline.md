# ONE Gateway V3 — API specification outline

> **21 September update:** The [static API walkthrough](../../one-api-brief/dist/one-api-walkthrough.html) and [LLM-ready Markdown](../../one-api-brief/dist/one-api-walkthrough.md) carry example parameters through business wallet setup → Fireblocks Flow collection → crypto batch payouts. They add proposed field names, statuses, intent-scoped checkout access, batch version checks and a per-item broadcast-report handoff for discussion. All ONE additions remain proposals; no mock API server is required. Auto-conversion is on hold, with the earlier material below retained for reference.

**Draft for Bryan and Mark · 20 September 2026**

For the simpler four-section reading view, open the [HTML API and service brief](../../one-api-brief/dist/one-gateway-api-brief.html). This outline remains the detailed reference.

This document starts with ONE's existing API, explains the technical and business purpose of each operation, and then adds Dynamic Business Accounts and Fireblocks Flow. The proposed Gateway contract follows from those capabilities. The demo is an extension of the existing merchant experience; its current mock routes are examples to revise against this specification, not an agreed API.

**Working model:** ONE identifies the customer, holds its account records and provides banking/custody services. Dynamic Business Accounts give a business shared wallets with explicit administration, signing and policy controls. Flow handles a particular payment's funding, routing and settlement. Gateway connects these records into a merchant-facing payment request and receipt.

## Contents

1. [Objects and responsibilities](#1-objects-and-responsibilities)
2. [Existing ONE API: all 25 operations](#2-existing-one-api-all-25-operations)
3. [Dynamic Business Accounts: the wallet layer](#3-dynamic-business-accounts-the-wallet-layer)
4. [Fireblocks Flow: the payment layer](#4-fireblocks-flow-the-payment-layer)
5. [Proposed ONE services and Gateway contract](#5-proposed-one-services-and-gateway-contract)
6. [How the calls join into merchant journeys](#6-how-the-calls-join-into-merchant-journeys)
7. [What to mock and what can use an existing integration](#7-what-to-mock-and-what-can-use-an-existing-integration)
8. [Unresolved contract details](#8-unresolved-contract-details)

### Evidence labels

- **Published ONE:** present in ONE's current public OpenAPI, API version `v1.0`. Documentation reviewed; no authenticated ONE sandbox calls were made in this review.
- **Documented Dynamic:** published vendor operations. Business Accounts are **early access**; access in our environment has not been verified.
- **Documented Flow:** published vendor HTTP/SDK operations. The existing demo exercises a narrower testnet configuration.
- **Proposed Gateway:** our draft business contract. Paths, schemas and state names below require product/backend review before implementation.
- **Demo only:** presenter controls and synthetic data; these are not provider operations.

## 1. Objects and responsibilities

| Object | What it represents | What it does not establish |
| --- | --- | --- |
| ONE organisation / subsidiary | The ONE customer/entity and its permitted organisational relationships. | A Dynamic account, wallet signer or completed KYB decision merely because a record exists. |
| ONE account | A bank or crypto-custody account exposed by ONE, with its own balance, status and identifiers. | A Dynamic business wallet. Creating a bank account does not create an embedded wallet. |
| Dynamic business account | A team ownership and access container for embedded wallets, with members and wallet-specific signers. | A bank account, legal-entity onboarding record or necessarily an onchain smart-contract account. |
| Dynamic wallet | The wallet owned by that business account; authorised signers can use it, subject to policy. | A ONE fiat balance or an entitlement for ONE to move its assets. |
| Settlement profile — proposed | A merchant's approved wallet, network and asset selection. Each payment locks a snapshot of it. | Permission to change the destination of an already-created Flow. |
| Payment intent — proposed | The merchant's request to collect an amount for an order, independent of one provider attempt. | An existing ONE bank `paymentId` or proof of receipt. |
| Flow attempt | One provider Flow tied to an intent and its immutable destination/settlement configuration. | A reusable business wallet or a fiat credit. |
| Receipt / reconciliation record — proposed | The connection among intent, Flow, source transaction, settlement transaction and, when applicable, separate ONE payment/transaction IDs. | Evidence that all these systems share one balance or lifecycle. |

Maintain explicit bindings: `ONE organisation → merchant → Dynamic environment + businessAccountId → walletId → network address`. Derive tenant access from authenticated ONE context. Dynamic's `externalRef` is a useful label but is not unique and cannot authorise that binding. A wallet balance, ONE available balance and amount collected through Flow must remain distinct.

## 2. Existing ONE API: all 25 operations

Source: [ONE public API](https://docs.one.io/). The documented server is `https://integration-api.uk-sbx-1.credis.tech`. Every path below starts with `/api/v1`.

The contract describes a bearer JWT plus encrypted `X-Partner-Authorization` customer context. Keep these credentials in ONE's backend adapter. A merchant's Dynamic session and a Flow session token serve different purposes. Table inputs are the important fields, not a replacement for the provider's full schemas.

### Customer identity and access

| # | Published operation | Technical purpose and main contract | Business purpose |
| --- | --- | --- | --- |
| 1 | `POST /api/v1/auth/token` | Administrator `email` and `password` produce an `accessToken`. | Authenticate the integration to ONE; this neither signs a wallet transaction nor onboards a merchant. |
| 2 | `GET /api/v1/organisation` | Returns organisation identity, master-customer status, subsidiaries and access flags. | Determine which customer/entity the integration serves and which subsidiary relationships it may use. |
| 3 | `POST /api/v1/organisation/subsidiaries` | Creates a subsidiary under a master customer using registration, contact, legal-type and address details; returns organisation information. | Represent another business/entity in the ONE customer structure. Eligibility and access must still be checked. |

### Accounts and balances

| # | Published operation | Technical purpose and main contract | Business purpose |
| --- | --- | --- | --- |
| 4 | `GET /api/v1/accounts` | Lists accounts; description supports `accountType`, IBAN/account-number/sort-code selectors. Returns IDs, currency, balance, available balance, pending funds, status and bank/crypto receiving details. | Show the merchant's existing ONE accounts and where funds can be received. Crypto account results include `cryptoAddresses`. |
| 5 | `POST /api/v1/accounts` | Creates a **bank account** with `type` (`international` / `domestic`), `currency` (published enum: `EUR` / `GBP`) and `isPrimary`; returns account and bank identifiers. | Open supported fiat receiving/payment accounts. It does not provision a Dynamic wallet. |
| 6 | `GET /api/v1/accounts/{accountId}` | Reads one ONE account's details, balances and status. | Populate an account detail screen and check funds available for a ONE payment. |
| 7 | `PUT /api/v1/accounts/{accountId}/primary` | Sets an account as primary. | Choose the default ONE account; this does not update a Flow settlement destination. |

**Schema issue:** the list description treats selectors as optional and fiat as the default, while the generated parameter schema marks all four selectors required. Confirm actual sandbox behaviour. The list's example uses `Crypto` while its enum uses `crypto`; use the accepted contract after confirmation. Do not infer USD account creation from examples of USD balances elsewhere.

### Crypto custody and withdrawal destinations

| # | Published operation | Technical purpose and main contract | Business purpose |
| --- | --- | --- | --- |
| 8 | `GET /api/v1/crypto-custody/withdrawal-addresses` | Lists registered destinations: ID, name, address, asset ID, status and creation time. | Let the customer choose a recognised custody withdrawal destination. |
| 9 | `POST /api/v1/crypto-custody/withdrawal-addresses` | Registers a destination using name, address, asset ID and optional tag; returns the record and status. | Add a destination for future ONE custody withdrawals. An example showing `approved` does not promise automatic approval. |
| 10 | `PUT /api/v1/crypto-custody/withdrawal-addresses/{id}` | Updates the destination's **name**. | Rename a saved recipient; not redirect an existing destination. |
| 11 | `DELETE /api/v1/crypto-custody/withdrawal-addresses/{id}` | Removes the registered address. | Stop offering it for future withdrawals; cannot reverse an onchain payment. |
| 12 | `POST /api/v1/crypto-custody/withdrawals` | Submits a withdrawal from a ONE custody `accountId` to `withdrawalAddressId`, with amount, fee options, note and optional `externalTxId`. Returns withdrawal ID, transaction ID, external reference, status and amount. | Move assets held in ONE's custody service to an approved address. This does not authorise spending from a merchant's Dynamic wallet. |

An `externalTxId` repeated on a withdrawal is documented as **rejected**, not as replaying the original response. Recover by reconciling the original request; do not substitute a new ID after an ambiguous timeout and risk a duplicate withdrawal. The docs do not expose a separate withdrawal-status GET operation. Confirm how the returned transaction ID maps to the transaction API.

### FX and deal instructions

| # | Published operation | Technical purpose and main contract | Business purpose |
| --- | --- | --- | --- |
| 13 | `GET /api/v1/exchange-rates` | `currencyFrom` and `currencyTo` return an indicative rate, timestamp and staleness indicator. | Display estimated conversion value. This is not an executable trade. |
| 14 | `POST /api/v1/payout/spot-rate` | Requests an FX quote using lock side, payment currency, settlement currency and amount; returns `quoteId`, rate and amounts. | Price a conversion before committing. |
| 15 | `POST /api/v1/payout/book-deal` | Books a `quoteId`; returns order number, token and settlement date. | Commit to the FX deal. Treat booking as a financial action, not a preview. |
| 16 | `POST /api/v1/payout/instruct-deal` | Assigns booked orders to payments/beneficiaries and settlement accounts; returns order/value-date information. | Tell ONE how the booked FX deal should be funded and paid or allocated. |

These operations document an FX workflow. They do **not** establish a stablecoin-to-fiat off-ramp or Talos API contract. Beneficiary IDs appear in deal instructions, but beneficiary creation/management is not among these 25 published operations.

### Payments and transfers

| # | Published operation | Technical purpose and main contract | Business purpose |
| --- | --- | --- | --- |
| 17 | `POST /api/v1/payments/swift` | Submits source account, amount/currency, recipient and bank/address information, reference and fee option; returns a payment ID. | Request an international bank payment through SWIFT. |
| 18 | `POST /api/v1/payments/sepa` | Submits account, amount/currency, recipient name, IBAN and country, plus optional details; returns a payment ID. | Request a payment over the SEPA rail, subject to supported currency and account eligibility. |
| 19 | `POST /api/v1/payments/chaps` | Submits source/recipient bank details, amount/currency, name and required purpose/category-purpose fields; returns a payment ID. | Request a UK CHAPS payment. |
| 20 | `POST /api/v1/payments/fps` | Submits source/recipient bank details, amount/currency, name and reference; returns a payment ID. | Request a UK Faster Payment. |
| 21 | `POST /api/v1/payments/transfers` | Uses `fromAccountId`, `toAccountId`, amount and description; returns a payment ID. | Transfer between supported ONE accounts addressed by ID. Do not assume cross-currency conversion. |
| 22 | `POST /api/v1/payments/internal` | Uses source account and recipient bank identifiers, amount and description; returns a payment ID. Its descriptive documentation is `TODO`. | Candidate internal payment addressed by recipient details; recipient reach and ownership restrictions need ONE confirmation. |
| 23 | `GET /api/v1/payments/{paymentId}` | Returns payment ID, state, payment transaction and fee transaction. | Track a ONE payment and its associated fee separately. A created payment ID is not a completed payment. |

The state schema includes pending organisation/compliance approval, several rejection states, awaiting funds, completion variants, expiry and unexpected/unknown states. Keep the raw provider state and use an explicit mapping; do not infer completion from a successful submission response.

### Transaction history and reconciliation

| # | Published operation | Technical purpose and main contract | Business purpose |
| --- | --- | --- | --- |
| 24 | `GET /api/v1/transactions` | Paginates transaction records with filters for bank identifiers, currency, dates, amounts, status, type, references and counterparties; may include subsidiary transactions. | Search account activity and reconcile payments, fees and balances. An `accountId` query filter is not published here. |
| 25 | `GET /api/v1/transactions/{transactionId}` | Returns a specific transaction with its status, amounts/currencies and references. | Retrieve the detailed accounting/payment record for investigation or reconciliation. |

ONE also documents callback envelopes including `payment.state-changed` and `account.status-changed`. These are provider notifications, not additional merchant request endpoints. Their authentication, retry, ordering and delivery guarantees must be confirmed before using them as accounting evidence.

**What the catalogue leaves open:** no published Gateway invoice/checkout/payment-intent creation, Dynamic business-wallet provisioning, Flow-to-order mapping, or stablecoin off-ramp contract was found among these operations. This describes the public documentation, not the absence of internal ONE APIs.

## 3. Dynamic Business Accounts: the wallet layer

Dynamic separates **members who administer the business account** from **signers who authorise wallet transactions**. An admin is not automatically a signer. The account has exactly one owner and may have admins/viewers and wallet-specific end-user/server signers. Business Accounts are currently **early access**. [Business Accounts overview](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/overview)

The official pages describe JavaScript SDK functions. The table deliberately uses those names; it does not invent equivalent public REST paths.

| Documented operation | Technical behaviour | Business use in ONE |
| --- | --- | --- |
| `createBusinessAccount({name, externalRef, metadata})` | Creates the team account; authenticated caller becomes owner. The fields shown are optional. | Establish the merchant's wallet ownership container and label it with an internal merchant reference. |
| `listBusinessAccounts()` / `getBusinessAccount({businessAccountId})` | List the caller's memberships or retrieve account, members, wallets and signers. | Show the right business workspace and verify the ownership/access relationship. |
| `createWalletForBusinessAccount({businessAccountId, chain, ...})` | Creates an embedded wallet owned by the account; the caller becomes its first signer. Optional share-protection/signing-scheme settings apply. | Provision a merchant operating/settlement wallet with explicit first-signer identity. |
| `addWalletToBusinessAccount({walletId, businessAccountId})` | An existing embedded wallet's owner links it to a business account; one business account per wallet. Caller becomes first signer. | Bring an existing embedded wallet under the business team. Pass the target account explicitly. |
| `addBusinessAccountMember(...)` / `updateBusinessAccountMemberRole(...)` / `removeBusinessAccountMember(...)` | Add an identity as admin/viewer, change its role or remove it. Member removal also removes that member's signer records on the account's wallets. | Invite finance staff, change responsibilities and offboard access. Adding a member alone does not grant signing. |
| `transferBusinessAccountOwnership({businessAccountId, newOwnerUserId})` | Transfers ownership to an existing member; previous owner becomes admin and must reauthenticate. | Change the business's responsible owner without creating a new wallet. |
| `addBusinessAccountSigner(...)` | Adds an end-user/server signer using a wallet account and target identity. Caller must be owner/admin **and** an active signer of that wallet; key shares are redistributed. | Grant a person or authorised automation the ability to move funds. This is more consequential than adding a viewer. |
| `removeBusinessAccountSigner({businessAccountId, walletId, signerId})` | Revokes that signer's access; cannot remove the last active signer. | Revoke spending authority while retaining the business wallet and other signers. |
| `getWalletAccounts()` + standard wallet signing methods | A signer selects the wallet and uses the normal message/transaction signing interface. | Approve an outgoing transfer or a Flow funding transaction. There is no separate business-account signing API. |
| `checkStepUpAuth({scope})` + a documented MFA/passkey/OTP verification method | Obtains action-scoped elevated authentication for sensitive membership, signer, ownership and wallet-linking changes. | Require fresh authentication when changing access. This is different from collecting another person's transaction approval. |
| `createPolicy({scope, chain, chainIds, rules})` | Creates/updates rules at an account, wallet or signer scope. | Set permitted/blocked addresses, per-transaction limits and export restrictions. |
| `getPolicy({scope})` / `removePolicyRules(...)` | Read the policy or remove specified rule types, subject to authority. | Explain and maintain the wallet's operating constraints. |

Sources: [account creation/read](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/create-a-business-account), [wallet creation/linking](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/add-wallets), [members and roles](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/members-and-roles), [signers](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/manage-signers), [signing](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/signing), [step-up authentication](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/step-up-auth), [policies](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/policies/overview).

### Concrete design for the merchant wallet

For the proposed merchant-controlled setup, the merchant's authenticated representative creates the business account and wallet, becoming owner and first signer. ONE records the verified relationship. A backend call made as a ONE-controlled identity would instead make that identity owner/first signer; the label “merchant wallet” does not change this.

An additional ONE admin or server signer is an explicit access choice, not a default implied by integration. Admins can affect policies and access even when they cannot sign. We should describe the actual signing, recovery, export and policy controls before making a custody claim.

Policies compose across environment, business account, wallet and signer. Every applicable layer must pass. A signer rule cannot bypass a broader restriction. Amount limits use the asset's smallest units; specify the asset and decimals explicitly. Persist stable business/wallet/signer identifiers and refresh the current `shareSetId` after signer changes. Serialize policy writes to one scope because the documented helper does not lock concurrent updates. Preserve unfamiliar rules when reading/updating policies. [Policy contract](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/policies/overview)

**Availability boundary:** Dynamic's quorum policies are marked **coming soon**. `requireApprovals`, governance changes and proposal approval/execution are described as a future contract whose shape may change. Do not present two-person approval as a currently working Business Accounts feature. MPC threshold signing and business approval quorum are separate concepts. [Quorum policies](https://www.dynamic.xyz/docs/javascript/reference/business-accounts/policies/quorum-policies)

A business-owned embedded wallet is useful without introducing smart-contract accounts. Keep smart-account features as a separate later decision, consistent with the meeting scope.

## 4. Fireblocks Flow: the payment layer

Flow runs through a Dynamic environment. Dynamic embedded wallets are optional: a merchant destination or payer source can use another supported wallet model. The HTTP guide uses `https://app.dynamicauth.com/api/v0` as its base. Existing demo configuration should be reconciled with vendor guidance rather than silently migrated between hostnames. [Flow HTTP guide](https://www.dynamic.xyz/docs/overview/fireblocks-flow-api)

In the paths below, `{env}` means Dynamic's `environmentId` and `{id}` means its `flowId`.

| Documented operation | Technical behaviour | Business purpose / Gateway mapping |
| --- | --- | --- |
| `POST /server/{env}/flow/payment` | Backend fixes amount, fiat denomination, settlement tokens/networks, destination, expiry and metadata. Uses server API token with `flow.write`. | Create a provider attempt for a fixed merchant invoice or checkout. |
| `POST /server/{env}/payment-links` | Creates a payment Flow and a shareable payer URL; supports payer-page base URL configuration. | Use provider payment links when their page/URL model fits, or retain ONE checkout over the same Flow lifecycle. |
| `POST /server/{env}/flow/deposit` | Creates a sender-amount funding flow with configured settlement and destination. | Let a customer top up a supported destination. Keep distinct from an invoice whose receiver fixes the amount. |
| `POST /server/{env}/flow/withdraw` | Creates an outgoing Flow from the platform's treasury/vault/server wallet to an end user. Funding-wallet signing is still required. HTTP-only money-out path. | Route a payout where ONE or the authorised merchant automation can actually sign for the funding wallet. |
| `POST /sdk/{env}/flow/{id}/source` | Attaches the wallet/exchange/deposit-address source, starts asynchronous screening and returns a Flow session token. | Associate the payer's funding source and begin eligibility checks. |
| `POST /sdk/{env}/flow/{id}/quote` | Quotes the source token and route, returning amounts, fees, quote version and expiry. Guide describes 60-second quotes. | Show the payer what they will spend and what the destination receives. A quote is not payment. |
| `POST /sdk/{env}/flow/{id}/prepare` | Prepares the signing payload for the selected quote after checks. | Present an executable payment for approval. |
| Wallet/chain signing and submission — **not a Flow HTTP endpoint** | The authorised source wallet signs and submits the prepared transaction. | The payer or funding-wallet signer authorises the movement of assets. |
| `POST /sdk/{env}/flow/{id}/broadcast` | Reports the already-submitted transaction hash to Flow. It does not itself broadcast onchain. | Start/continue provider tracking of the source payment and settlement. |
| `GET /sdk/{env}/flow/{id}` | Reads current execution, risk and settlement state. The guide documents the read as unauthenticated. | Recover checkout state and reconcile the attempt. Knowing a Flow ID is not authority to edit an order. |
| `POST /sdk/{env}/flow/{id}/cancel` | Requests cancellation before broadcast in supported states. | Abandon an unfunded attempt. Cancellation is not a refund or reversal. |
| `POST /environments/{env}/webhooks` | Registers provider notifications using administrative backend authentication. | Receive `flow.execution.updated`, `flow.risk.updated` and `flow.settlement.updated` to reconcile orders. |

The source-attachment response's `dft_...` token is a one-Flow capability used by subsequent SDK mutation calls. Server API tokens stay in the backend. The HTTP guide shows a session header on the same source call that issues that token; verify the initial attachment/bootstrap contract against the SDK and provider rather than inventing authentication behaviour.

With **deposit-address** funding, the payer sends funds from their wallet/exchange to a transaction-specific address supplied during quoting. Our checkout skips the wallet prepare/sign/broadcast interaction, but the payer still authorises the transfer at its origin. That deposit address is not the merchant's permanent business wallet. Testnet support is narrower: the existing harness uses wallet-source, same-token Base Sepolia USDC, without swaps or bridges. [Flow guide](https://www.dynamic.xyz/docs/overview/fireblocks-flow-api)

### What counts as payment completion

Flow's risk, execution and settlement states are separate. `source_confirmed` establishes source progress; it does not establish that the merchant received funds. A verified `settlementState: completed` is the provider's delivery signal. Store the destination chain and settlement transaction hash alongside source evidence. A settlement failure after source confirmation needs investigation; it must not be reduced to an unpaid order that can blindly be paid again.

Provider webhook events carry `eventId`, `eventName`, environment, timestamp and a data object including `flowId`, axis and state transition. The settlement event can include a settlement transaction hash and destination-chain details. These differ from the local demo's proposed `payment.*` merchant events. Verify webhook authenticity and reconcile current provider state before emitting a merchant receipt. [Event and settlement contract](https://www.dynamic.xyz/docs/overview/fireblocks-flow-api)

## 5. Proposed ONE services and Gateway contract

**All new routes and JSON in this section are proposals, not published ONE or Dynamic endpoints.** Business wallets belong to ONE account services, using `/api/v1/crypto-wallets` as the working namespace alongside `/api/v1/crypto-custody`. ONE may choose a unified accounts model instead. Gateway references those wallet resources; it does not own their lifecycle. Crypto payouts and auto-conversion addresses are also shared ONE services. `/gateway/v3` remains the proposed collection and checkout layer.

The first contract needs to answer: which merchant wallet is this, where will this payment settle, what is owed, and what actually happened? Keep provider membership, cryptographic operations and signing in their documented SDK workflows. ONE’s account, payout and conversion services own the corresponding business records and orchestration. Parameter summaries remain deferred; link to official provider schemas.

### Candidate operations

| Proposed route | Request → response outline | Business responsibility |
| --- | --- | --- |
| `POST /api/v1/crypto-wallets` | Dynamic business-account and wallet references → verified ONE wallet resource with provider IDs and network addresses. | Register the wallet in shared ONE account services after Dynamic provisioning; verify the merchant relationship and provider evidence. Gateway, payouts and treasury use the same resource. |
| `GET /api/v1/crypto-wallets` / `GET /api/v1/crypto-wallets/{walletId}` | Authenticated merchant scope → its registered wallets and verification/access metadata. | Display the merchant's business wallets alongside, but separately from, ONE accounts. Keep wallet type and signing authority explicit; do not fabricate a bank-style available balance. |
| `POST /gateway/v3/settlement-profiles` | Verified ONE wallet ID, supported network and token identity → immutable profile ID and resolved destination. | Choose a settlement destination. Creating a replacement profile leaves existing payment snapshots intact. |
| `GET /gateway/v3/settlement-profiles/{profileId}` | Profile ID → authorised merchant's immutable settlement configuration. | Explain the intended receipt asset/network and wallet. |
| `POST /gateway/v3/payment-intents` | Amount, denomination, merchant order reference, profile ID and optional expiry → intent ID and ONE checkout URL. | Create the merchant's collection request; lock its amount and destination snapshot. |
| `GET /gateway/v3/payment-intents` / `GET /gateway/v3/payment-intents/{intentId}` | Merchant scope and supported pagination/filtering → intent summaries or full attempts/receipt. | Give the merchant one view of collection progress and evidence. Define list filters in the full schema; do not inherit unrelated ONE transaction filters. |
| `POST /gateway/v3/payment-intents/{intentId}/attempts` | Intent ID + idempotency key → one Flow ID and attempt record. Amount/destination are read from the locked intent. | Start a provider attempt without trusting checkout-supplied financial terms. Reuse a valid active attempt; preserve earlier attempts. |
| `POST /gateway/v3/payment-intents/{intentId}/cancel` | Intent ID → confirmed cancellation or a conflict/indeterminate result. | Stop an unfunded request after reconciling any active provider attempt. A pending cancellation is not immediately final. |

For the first mock, select one supported merchant wallet, one asset/network and one settlement profile. Broader routing options should be added when demonstrated. Wallet provisioning and signer/policy workflows may be shown with clearly labelled fixtures until early-access capability is verified.

### Shared crypto payout and conversion services

| Proposed operation | Purpose | Service boundary |
| --- | --- | --- |
| `POST /api/v1/crypto-payouts/batches` | Create a batch from an API list or imported CSV and return recipient validation results. | Creates a job; does not move funds. Verify whether ONE’s existing dashboard batch service can own the job. |
| `POST /api/v1/crypto-payouts/batches/{batchId}/submit` | Submit the validated job under the funding account or wallet’s authority. | Execute each item through the custody withdrawal path or authorised wallet signing/Flow route. |
| `GET /api/v1/crypto-payouts/batches/{batchId}` | Read batch progress and per-recipient status, fees, references and transaction evidence. | A submitted batch is not an atomic onchain transaction or proof that every item succeeded. |
| `POST /api/v1/crypto-custody/conversion-addresses` | Provision an approved ONE receiving address bound to a merchant’s standing conversion instruction. | A new receiving service, separate from registering an outbound withdrawal address. |
| `GET /api/v1/crypto-custody/conversion-addresses` / `GET /api/v1/crypto-custody/conversion-addresses/{id}` | Read assigned addresses, supported deposit routes, instructions and linked fiat accounts. | The address directs eligible deposits into ONE conversion and crediting, under the merchant’s instruction. |

Start crypto batches with one funding source and one payout asset/network. Every recipient retains its own reference and outcome. Keep successful items, reconcile ambiguous submissions, and retry only eligible failed items. A ONE custody batch uses existing custody authority; a Dynamic business-wallet batch requires an authorised signer. ONE’s dashboard batch capability is a product-reuse lead from Bryan, not verified production or API evidence in this review.

**Auto-conversion address promise:** send a supported crypto asset or stablecoin on the configured network to the assigned ONE address and receive the selected fiat proceeds in the linked ONE account. On activation, the merchant agrees the standing instruction, target account, pricing/fee rule and supported route. ONE detects and confirms each deposit, applies its checks, sweeps/transfers if needed, executes the conversion and credits the confirmed fiat amount. Sweeping crypto does not itself execute an FX trade or create fiat.

Preserve deposit → instruction version → trade/fill → fee → fiat credit references. Define minimums, rate timing, limits, address suspension/retirement and unsupported or late deposits. Conversion failure remains an exception with the crypto receipt preserved. A fixed fiat payout requires an explicit quote; an ordinary standing address credits actual execution proceeds under the agreed rules. The address is a ONE-controlled service destination, distinct from a merchant-controlled Dynamic wallet and a transaction-specific Flow deposit address. Custody address provisioning, deposit events, conversion/Talos and ledger contracts remain to be confirmed.

### Example: create a merchant collection request

**Optional enhancement to an existing endpoint:** the HTML brief also proposes `GET /api/v1/organisation?include=businessWallets`, returning wallet references alongside the existing organisation response. This parameter and its fields are not published ONE behaviour. Omit them by default and preserve existing customer/account semantics. If ONE prefers to leave v1 unchanged, `GET /api/v1/crypto-wallets` alone provides the capability. Add parameters where the resource and authority remain the same; use a separate endpoint where the business object or authority changes.

Illustrative request, using fictional identifiers:

```http
POST /gateway/v3/payment-intents
Authorization: Bearer <ONE merchant credential>
Idempotency-Key: demo-order-1042-create
Content-Type: application/json
```

```json
{
  "amount": "25.00",
  "currency": "USD",
  "merchantReference": "DEMO-ORDER-1042",
  "settlementProfileId": "DEMO-PROFILE-USDC",
  "expiresInSeconds": 900
}
```

Illustrative response:

```json
{
  "id": "DEMO-INTENT-1042",
  "environment": "mock",
  "amount": "25.00",
  "currency": "USD",
  "merchantReference": "DEMO-ORDER-1042",
  "status": "awaiting_payment",
  "settlement": {
    "profileId": "DEMO-PROFILE-USDC",
    "walletId": "DEMO-BUSINESS-WALLET",
    "chainId": "84532",
    "asset": "USDC",
    "tokenAddress": "DEMO-NON-ACTIONABLE-TOKEN",
    "destinationAddress": "DEMO-NON-ACTIONABLE-DESTINATION"
  },
  "checkoutUrl": "https://checkout.example.invalid/pay/DEMO-INTENT-1042",
  "expiresAt": "2026-09-21T17:15:00Z",
  "attempts": [],
  "receipt": null
}
```

This is a contract example, not a newly supported test payment: the real harness remains fixed at **1.00 USD** on its configured test route. In a real adapter, the backend resolves a valid token identity and verified wallet destination from the profile; the browser cannot supply them at attempt creation. USD invoice value and USDC received are different amounts/units. Record quoted and actually delivered token amounts, fees and decimals explicitly rather than assuming one-to-one conversion.

### Required behaviour of the new contract

| Concern | Proposed rule |
| --- | --- |
| Identity and authority | Derive the merchant from authenticated context; check ownership of every wallet, profile and intent. A checkout capability grants only that intent's payer operations. It is not a merchant credential. |
| Amounts and assets | Use decimal strings for new API money fields; keep invoice denomination separate from received token amount, contract address, chain and decimals. Preserve existing ONE request types in its adapter. |
| Idempotency | For proposed creation calls, same merchant + operation + key + same payload returns the original result; changed payload returns `409`. Persist the request before provider creation. An uncertain upstream response triggers reconciliation, not another blind create. Confirm Flow duplicate-prevention/correlation behaviour. |
| Immutable terms | Store amount, expiry and resolved destination/asset snapshot with the intent and Flow. A profile replacement never redirects an active attempt. Verify the provider's authoritative configuration before allowing signing, preserving the existing harness control. |
| Attempts and retries | At most one active attempt per intent. A new attempt requires the previous one to be reconciled as terminal and unfunded. After source submission/confirmation, investigate or recover the existing attempt instead of authorising a second payment. |
| States | Return merchant status **and** raw provider risk/execution/settlement states. Mark `settled` only from reconciled delivery evidence. Preserve source and settlement hashes separately. |
| Cancellation and expiry | Reconcile provider state first. Once funds are submitted, expiry/cancel cannot erase payment evidence or initiate a refund. Late settlement must still be recorded and surfaced for review. |
| Events | Deduplicate by provider environment + event ID. Store receipt of each event; account for delayed/out-of-order delivery using current provider state. Proposed merchant event IDs and names are separate from Flow events. |
| Errors | Define `400` malformed input, `401` unauthenticated, `403` missing authority, `404` absent/not-visible resource, `409` state/idempotency conflict and `422` unsupported business combination. Provider uncertainty remains visible instead of being reported as definitive failure. |
| Secrets | Do not return API secrets, key shares, share passwords or elevated authentication tokens in ONE merchant records. The SDK manages signing material and short-lived provider capabilities in the authorised context. |

### Proposed merchant status mapping

| Evidence | Merchant status / meaning |
| --- | --- |
| Intent exists; no source payment | `awaiting_payment` |
| Source submitted or confirmed; settlement unresolved | `processing` — not yet a merchant receipt |
| Reconciled provider settlement completed at the locked destination | `settled` — stablecoin receipt; no automatic ONE fiat credit |
| Screening blocks an unfunded attempt | `blocked` |
| Confirmed expiry/cancellation with no source funds | `expired` / `cancelled` |
| Definitive failure with no funds sent | `failed` |
| Source funds exist but settlement fails, evidence conflicts, or outcome is ambiguous | `requires_review` — retain all evidence and prevent an automatic second payment |

These names are our proposed merchant vocabulary, not a claim about vendor enums. The full OpenAPI and mocks should encode this mapping after reviewing this outline.

## 6. How the calls join into merchant journeys

### A. Give a merchant a business wallet

1. Read the authorised customer context through ONE's organisation/account APIs. Existing customer eligibility remains ONE's responsibility.
2. The merchant representative authenticates with Dynamic, calls `createBusinessAccount`, then `createWalletForBusinessAccount`. That representative is owner and first signer.
3. Register the verified provider relationship in ONE through proposed `POST /api/v1/crypto-wallets`.
4. Add staff as members; separately add signers where spending authority is intended. Configure supported policies with the appropriate authority and step-up requirements.
5. Create an immutable settlement profile for the selected wallet, network and asset.

### B. Collect a checkout payment into that wallet

1. Merchant creates a ONE payment intent for its order and settlement profile.
2. Checkout starts/resumes its Flow attempt. ONE's backend creates the provider payment from the locked terms.
3. Payer attaches a source, passes screening, receives a quote and approves the source transaction. The payer may use an external wallet; a Dynamic business account is not required for the payer.
4. Flow reports source progress and eventual settlement. ONE reconciles the Flow to the intent and stores the destination transaction evidence.
5. Merchant sees a stablecoin receipt in its wallet. The ONE fiat account is unchanged.

### C. Move money out or convert to fiat

| Funds currently held in | Existing/proposed path | Necessary authority / missing contract |
| --- | --- | --- |
| ONE crypto custody account | Published withdrawal-address and crypto-withdrawal APIs. | ONE custody account authority and approved destination; verify withdrawal status correlation. |
| Dynamic business wallet | Standard wallet signing for a direct transfer; Flow withdrawal where a supported treasury/server signer can fund its routed payout. | A real authorised signer and applicable policies. An API request from ONE alone does not confer signing rights. Validate Flow's funding-wallet integration before promising this path. |
| Merchant wallet, with fiat requested | Merchant sends supported funds to an assigned ONE auto-conversion address under a standing instruction → ONE conversion → fiat ledger credit → optional bank payout. | An authorised transfer from the merchant wallet is still required. Deposit detection, conversion, pricing and ledger contracts must support the instruction. |
| ONE fiat account | Published SWIFT/SEPA/CHAPS/FPS/internal payment APIs, then payment/transaction reads. | Available funds, rail eligibility and ONE's approval/compliance state. |

Refunds are a separate outgoing instruction tied to the original receipt, with recipient, amount, asset/network and signing authority. They belong to the shared ONE crypto payout service and may use the same per-item execution machinery as batches. Do not model refunds as Flow cancellation.

A merchant may also elect to have compatible Flow settlement sent directly to its assigned ONE auto-conversion address. In that elected path, the merchant has already instructed the ONE conversion service; it is not a merchant-wallet stop followed by an unrequested sweep. The Gateway receipt and the later fiat credit remain separate evidence.

## 7. What to mock and what can use an existing integration

| Capability | Current evidence | Spec-first treatment |
| --- | --- | --- |
| Existing merchant dashboard | Working discussion prototype with fictional balances/wallets. | Keep it as the merchant-facing view of this contract. It does not establish API availability. |
| ONE accounts | Public read schemas; current local mocks implement account list/detail. No authenticated ONE access verified here. | Align fixtures with published shapes and documented ambiguities. Replace with a real adapter once the accepted sandbox contract is established. |
| Dynamic Business Accounts | Current early-access SDK documentation; no provisioning, member, signer or policy action tested in our environment. | Specify the real operations first. Label simulated wallets, memberships and policy results clearly. Quorum remains future/unavailable. |
| Flow | Existing credentialed create/verify harness and narrow same-token testnet route. | Reuse that integration for provider calls; bind it to ONE intents and real reconciliation only after the mapping is implemented. Do not call the separate mock merchant cycle provider-connected today. |
| Gateway intents / profiles / receipts | Proposed business records; current local intent routes are only a draft implementation. | Revise mock request/response examples and lifecycle against this outline before adding UI behaviour. |
| Demo outcomes | `/demo/*` controls simulate source confirmation, settlement, failures and local event replay. | Keep them outside the merchant/provider API contract. They provide presentation controls, not evidence of provider webhook delivery. |
| Crypto batches | ONE dashboard workflow flagged for reuse; no public crypto batch contract verified. | Mock validation and recipient-level partial results only after aligning the proposed batch service; keep custody and business-wallet authority distinct. |
| Auto-conversion addresses | Proposed ONE receiving-and-conversion service; custody address provisioning, crypto execution and ledger contracts unconfirmed. | Demonstrate the elected standing-instruction concept and distinct deposit/conversion/credit states; do not fabricate a fiat credit from a receipt. |

The existing 19 September build note remains the implementation record. This specification is the starting point for the next mock revision. No new UI, provider mutation, wallet, transaction or deployment was performed for this specification review.

## 8. Unresolved contract details

| Owner / source | Detail to resolve | Why it affects the API |
| --- | --- | --- |
| ONE backend | Sandbox credentials, authorised organisation context and partner-auth cipher: prose names AES-GCM-SIV while the helper uses AES-GCM terminology. | Required to authenticate the adapter correctly; do not choose an algorithm by guesswork. |
| ONE backend | Account selector requiredness/casing; available creation currencies; recipient reach of the undocumented internal-payment operation. | Prevents mocks from promising unsupported requests. |
| ONE backend | Asset-ID catalogue, withdrawal state lookup, callbacks and duplicate-reference recovery. | Needed for safe custody withdrawal and reconciliation. |
| ONE backend | Existing dashboard batch service, crypto recipient validation and item-level execution/retry interfaces. | Determines whether crypto batch payouts extend an existing service or require a new one. |
| ONE backend | Custody receiving-address provisioning, deposit events, beneficiary management and stablecoin-to-fiat/Talos/ledger APIs. | Needed for assigned auto-conversion addresses, standing instructions and verified fiat credit. |
| Dynamic | Early-access Business Accounts entitlement, compatible SDK version and supported identity/signing configuration. | Determines which wallet operations can be real in our environment. |
| Product / merchant control model | Merchant owner/first signer; any ONE administration; any server signer; policy/recovery/export powers. | Determines actual authority over funds. Proposed default here is merchant owner + merchant signer, with further powers explicit. |
| Dynamic / Flow | Initial source-token bootstrap; provider create idempotency/correlation; webhook authenticity and delivery/recovery rules. | Needed to implement the contract without duplicate flows, forged receipts or lost outcomes. |
| Product / ONE | Exact invoice amount/fee policy, late-payment handling, supported routes and the point at which a merchant order is fulfilled. | Turns provider lifecycle evidence into an unambiguous merchant promise. |

### Source and review record

ONE's live OpenAPI was retrieved from [docs.one.io](https://docs.one.io/) on 20 September 2026; all **25** published request operations are individually covered above. Dynamic's live Business Accounts and Flow documentation was reviewed the same day. Published capability is kept separate from account entitlement, tested integration and proposed ONE behaviour.

Related local records: [19 September API review and demo handoff](2026-09-19-api-review-and-demo.md), [existing operation inventory](one-api-operation-inventory-2026-09-19.json), and [Gateway V3 to TMS guiding concept](../../../proposals/gateway-v3-to-tms-message-concept.md).
