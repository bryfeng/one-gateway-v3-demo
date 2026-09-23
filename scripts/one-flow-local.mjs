import { execFileSync } from 'node:child_process';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getAddress, isAddress } from 'viem';

// Direct sandbox calls from this computer. No server, payer, or signing step.
const oneBase = 'https://integration-api.uk-sbx-1.credis.tech';
const dynamicBase = 'https://app.dynamicauth.com/api/v0';
const environmentId = '3608a494-ff5c-4cbc-a425-ddc382e4a90a';
const tokenAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const evidencePath = new URL('../.local/one-flow/last-run.json', import.meta.url);
const report = { startedAt: new Date().toISOString(), stage: 'configuration' };
class SafeError extends Error {}

function required(name) {
  const value = process.env[name];
  if (!value) throw new SafeError(`Missing ${name}.`);
  return value;
}

function keychain(service, account) {
  const args = ['find-generic-password', '-s', service];
  if (account) args.push('-a', account);
  args.push('-w');
  try {
    return execFileSync('/usr/bin/security', args, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
    }).replace(/\n$/, '');
  } catch {
    throw new SafeError(`Could not read Keychain item ${service}.`);
  }
}

async function api(url, init, label) {
  const response = await fetch(url, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  console.log(JSON.stringify({ step: label, httpStatus: response.status }));
  if (!response.ok) throw new SafeError(`${label} returned HTTP ${response.status}.`);
  try { return await response.json(); }
  catch { throw new SafeError(`${label} returned invalid JSON.`); }
}

async function save() {
  await mkdir(new URL('.', evidencePath), { recursive: true, mode: 0o700 });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}

function dynamicCredential() {
  const token = process.env.DYNAMIC_API_TOKEN || (process.env.DYNAMIC_KEYCHAIN_SERVICE
    ? keychain(process.env.DYNAMIC_KEYCHAIN_SERVICE, process.env.DYNAMIC_KEYCHAIN_ACCOUNT)
    : '');
  if (!token) throw new SafeError('Set DYNAMIC_API_TOKEN or DYNAMIC_KEYCHAIN_SERVICE to call Flow locally.');
  return token;
}

async function run() {
  if (process.argv.includes('--verify')) {
    Object.assign(report, JSON.parse(await readFile(evidencePath, 'utf8')));
    delete report.error;
    delete report.verified;
    report.stage = 'flow_created_verification_pending';
    await verifyFlow(dynamicCredential());
    return;
  }
  let accounts;
  const snapshotFlag = process.argv.indexOf('--one-response');
  if (snapshotFlag !== -1) {
    const path = process.argv[snapshotFlag + 1];
    if (!path || path.startsWith('--')) throw new SafeError('--one-response requires a captured response file.');
    const snapshot = JSON.parse(await readFile(path, 'utf8'));
    if (snapshot.httpStatus !== 200 || snapshot.endpoint !== `${oneBase}/api/v1/accounts?accountType=Crypto`) {
      throw new SafeError('Snapshot does not identify a successful ONE sandbox account read.');
    }
    accounts = snapshot.accounts;
    report.oneResponse = { source: 'Captured earlier API response; not refreshed in this run', observedAt: snapshot.observedAt };
  } else {
    const context = JSON.parse(required('ONE_USER_CONTEXT'));
    const key = Buffer.from(required('ONE_PARTNER_KEY'), 'base64');
    if (key.length !== 32 || !context.email || !context.user_id) {
      throw new SafeError('ONE partner key or user context is invalid.');
    }
    report.stage = 'one_login';
    const password = keychain('oneio-sandbox-api', context.email);
    console.log(JSON.stringify({ step: 'keychain', retrieved: true }));
    const auth = await api(`${oneBase}/api/v1/auth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: context.email, password }),
    }, 'one_login');
    if (typeof auth.accessToken !== 'string') throw new SafeError('ONE did not return an access token.');
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(context), 'utf8'), cipher.final()]);
    const headers = {
      Accept: 'application/json', Authorization: `Bearer ${auth.accessToken}`,
      'X-Partner-Authorization': Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64'),
    };
    report.stage = 'one_accounts';
    accounts = await api(`${oneBase}/api/v1/accounts?accountType=Crypto`, { headers }, 'one_crypto_accounts');
    report.oneResponse = { source: 'Live API read in this run', observedAt: new Date().toISOString() };
  }
  if (!Array.isArray(accounts)) throw new SafeError('ONE did not return an account array.');
  const candidates = accounts.flatMap((account) => {
    if (account.type !== 'crypto' || account.status !== 'active' || account.currency?.alpha3Code !== 'USDT') return [];
    return (account.cryptoAddresses ?? []).flatMap(({ primaryAddress }) => {
      if (typeof primaryAddress !== 'string' || !isAddress(primaryAddress)) return [];
      const address = getAddress(primaryAddress);
      if (/^0x0{40}$/i.test(address) || address.toLowerCase() === tokenAddress.toLowerCase()) return [];
      return [{ accountId: account.id, accountCurrency: 'USDT', address }];
    });
  });
  if (candidates.length !== 1) throw new SafeError(`Expected one active USDT EVM destination; found ${candidates.length}.`);
  report.one = { endpoint: `${oneBase}/api/v1/accounts?accountType=Crypto`, ...candidates[0] };
  const paymentIntentId = `ONE-BS-${randomUUID().toUpperCase()}`;
  const body = {
    amount: '1.00', currency: 'USD', expiresIn: 900,
    pegStablecoins: true, disableSwaps: false,
    settlementConfig: { strategy: 'cheapest', settlements: [{
      chainName: 'EVM', chainId: '84532', tokenAddress, symbol: 'USDC', tokenDecimals: 6,
    }] },
    destinationConfig: { destinations: [{ chainName: 'EVM', type: 'address', identifier: report.one.address }] },
    memo: { orderId: paymentIntentId, oneAccountId: report.one.accountId, destinationSource: 'ONE sandbox accounts API' },
  };
  report.flowRequest = { endpoint: `${dynamicBase}/server/${environmentId}/flow/payment`, body };
  report.stage = 'one_address_retrieved_flow_request_ready';
  await save();
  console.log(JSON.stringify({ step: 'destination_from_one_api', ...candidates[0] }));
  if (!process.argv.includes('--create')) return;
  const dynamicToken = dynamicCredential();
  const dynamicHeaders = { Accept: 'application/json', Authorization: `Bearer ${dynamicToken}` };
  // One creation attempt only. A network timeout may mean creation succeeded;
  // inspect provider state before repeating this command after an uncertain result.
  report.stage = 'flow_creation_pending';
  await save();
  const created = await api(report.flowRequest.endpoint, {
    method: 'POST', headers: { ...dynamicHeaders, 'Content-Type': 'application/json', 'X-Request-ID': randomUUID() },
    body: JSON.stringify(body),
  }, 'dynamic_create');
  const flowId = created.flow?.id;
  if (typeof flowId !== 'string' || !/^[0-9a-f-]{36}$/i.test(flowId)) throw new SafeError('Dynamic did not return a valid Flow ID.');
  report.flowId = flowId;
  report.stage = 'flow_created_verification_pending';
  await save();
  await verifyFlow(dynamicToken);
}

async function verifyFlow(dynamicToken) {
  const { flowId, flowRequest: { body } } = report;
  if (typeof flowId !== 'string' || !/^[0-9a-f-]{36}$/i.test(flowId)) throw new SafeError('No valid saved Flow ID to verify.');
  const response = await api(`${dynamicBase}/server/${environmentId}/flow/${flowId}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${dynamicToken}` },
  }, 'dynamic_server_verify');
  const flow = response.flow ?? response;
  report.providerState = { executionState: flow.executionState, settlementState: flow.settlementState, expiresAt: flow.expiresAt };
  const destination = flow.destinationConfig?.destinations;
  const settlements = flow.settlementConfig?.settlements;
  const match = flow.id === flowId && flow.mode === 'payment'
    && flow.amount === '1.00' && flow.currency === 'USD'
    && (flow.disableSwaps === undefined || flow.disableSwaps === false) && flow.pegStablecoins === true
    && flow.memo?.orderId === body.memo.orderId && flow.memo?.oneAccountId === report.one.accountId
    && flow.settlementConfig?.strategy === 'cheapest' && settlements?.length === 1
    && Object.entries(body.settlementConfig.settlements[0]).every(([k, v]) => String(settlements[0][k]).toLowerCase() === String(v).toLowerCase())
    && destination?.length === 1 && destination[0].chainName === 'EVM' && destination[0].type === 'address'
    && destination[0].identifier?.toLowerCase() === report.one.address.toLowerCase();
  if (!match) throw new SafeError('Created Flow did not match the ONE address and requested route. Flow ID saved; do not recreate blindly.');
  report.verification = {
    verifiedAt: new Date().toISOString(),
    destination: destination[0].identifier,
    settlement: settlements[0],
    amount: flow.amount, currency: flow.currency,
    referencesMatch: true,
    disableSwaps: flow.disableSwaps === undefined ? 'Not returned by provider; false was sent, routing remains untested' : false,
  };
  report.verified = true;
  report.stage = 'flow_created_and_destination_verified';
}

try {
  await run();
} catch (error) {
  report.error = error instanceof SafeError ? error.message : `Unexpected failure during ${report.stage}; credentials and provider bodies withheld.`;
  process.exitCode = 1;
} finally {
  await save();
  console.log(JSON.stringify({ stage: report.stage, flowId: report.flowId, verified: report.verified, error: report.error, evidencePath: fileURLToPath(evidencePath) }));
}
