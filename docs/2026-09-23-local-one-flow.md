# ONE wallet address → Flow, locally

This test proves that a Flow can use a receiving address read from ONE's API. No dashboard lookup, payer address, or hosted backend is needed to create it.

## Sequence

1. Read the ONE password from macOS Keychain (`oneio-sandbox-api`, with the API user's email as the account).
2. Log in with `POST /api/v1/auth/token`. Encrypt the API user context with the supplied partner key using AES-256-GCM, matching ONE's working sample.
3. Call `GET /api/v1/accounts?accountType=Crypto` with the bearer token and encrypted `X-Partner-Authorization` header. Select the unique active USDT account with a valid EVM receiving address; stop if the result is missing or ambiguous.
4. Copy `cryptoAddresses[].primaryAddress` into `destinationConfig.destinations[0].identifier` and create a payment Flow directly through Dynamic's server API. Carry the ONE account ID and payment-intent reference in `memo`.
5. Read the server-side Flow and compare its destination, settlement route, amount, and references with the request. Save the Flow ID before verification so a later failure does not lose the created attempt.

The payer connects at checkout, after creation. This script does not attach a source, request a signature, broadcast a transaction, or claim settlement.

## Run

Use Node.js 22.13 or later. Supply `ONE_PARTNER_KEY` and `ONE_USER_CONTEXT` (the JSON API user profile) through the process environment. For creation, also supply `DYNAMIC_API_TOKEN`, or `DYNAMIC_KEYCHAIN_SERVICE` and optionally `DYNAMIC_KEYCHAIN_ACCOUNT` for an existing Keychain item. Credentials are never written to the report.

```sh
# Retrieve ONE's address and prepare the exact Flow request.
node scripts/one-flow-local.mjs

# Retrieve the address, create one Flow, then verify it directly with Dynamic.
node scripts/one-flow-local.mjs --create

# Re-read the saved Flow without creating another or accessing ONE's password.
node scripts/one-flow-local.mjs --verify
```

`--one-response <file>` can reuse a previously captured ONE response instead of making a fresh account read. The file contains `endpoint`, `httpStatus`, `observedAt`, and `accounts`; the report explicitly labels this as a captured response. Use it only with an actual API capture from the intended account.

The non-secret result is saved locally at `.local/one-flow/last-run.json`, which Git ignores. It contains the source account reference, receiving address, exact request, and any returned Flow ID and verification result. Each run replaces that file. A timed-out create request is an uncertain outcome; inspect the provider state before retrying. This small test does not implement durable idempotency.

## Observed result — 23 September 2026

The local call created one Flow (`201`) and the server read returned `200`. Its stored destination matched the EVM address selected programmatically from the earlier successful ONE accounts response. Amount, currency, settlement token/network, and ONE account/payment references also matched. No payer was attached and settlement remained `none`.

The fresh ONE lookup timed out waiting for Keychain access, so this run reused the real API capture from earlier in the same task. This verifies the handoff into Flow, not an uninterrupted fresh login-to-Flow run. Details and the Flow ID are in the ignored local result file.

Dynamic did not echo `disableSwaps: false` in the server response. The verification records that omission rather than claiming the flag was confirmed; actual routing and payment still need a connected payer.

## Test route

The receiver amount is fixed at `1.00 USD`, pegged to test USDC on Base Sepolia (`84532`), contract `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Expiry is 15 minutes. `disableSwaps` is `false` because the current [Flow testnet documentation](https://www.dynamic.xyz/docs/flow/supported-chains) requires a swap or bridge; a later checkout must select a supported source route.

ONE labels the source account USDT, but this test only reuses its EVM address. The API response does not establish Base Sepolia custody support or ONE balance credit. Address handoff, on-chain delivery, and ONE ledger credit are separate observations.

The existing browser harness and Worker remain unchanged. Their older same-token, same-chain route should be revised against the current provider documentation before using them for this routed checkout.

References: [ONE API](https://docs.one.io/), [Flow create and execution sequence](https://www.dynamic.xyz/docs/flow/api).
