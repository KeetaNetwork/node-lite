# @keetanetwork/keetanet-node-lite

In-memory / local stand-in for `@keetanetwork/keetanet-node` with the same public import layout as **keetanet-client 0.18.7**. Useful for integration tests and local development without Redis, Postgres, Spanner, or GCP.

Build:

```bash
make dist
```

---

## CLI (`src/main.ts`)

After `make dist`, run a simple representative `LocalNode` with an in-memory ledger:

```bash
node dist/main.js
# or, if linked / installed with the package bin:
npx keetanet-node-lite
```

By default the process:

- Listens on `127.0.0.1` with an ephemeral port
- Serves the HTTP API at `http://<host>:<port>/api`
- Serves the P2P WebSocket at `ws://<host>:<port>/p2p`
- Generates a random representative seed (printed once) at seed index `0`
- Uses a local network id `0` with alias `test`

### Options

| Flag | Description |
|------|-------------|
| `--host <ip>` | Listen address (default `127.0.0.1`) |
| `--port <n>` | Listen port (default: ephemeral) |
| `--seed <hex>` | Representative seed |
| `--seed-index <n>` | Seed index (default `0`) |
| `--network <name>` | `local` (default), or `test` / `dev` / `staging` / `main` |
| `--alias <name>` | `nodeAlias` |
| `--p2p` / `--no-p2p` | Enable (default) or disable the P2P WebSocket |
| `--initial-staple` | Add a genesis vote staple (supply + delegation) |
| `--help` | Usage |

Example:

```bash
node dist/main.js --host 127.0.0.1 --port 8080 --seed "$(openssl rand -hex 32)" --initial-staple
```

Point a KeetaNet client at the printed `api` URL (include the `/api` path, e.g. `http://127.0.0.1:8080/api`).

Quick smoke check (valid route — there is no `/node/ledger/supply`):

```bash
curl -sS http://127.0.0.1:8080/api/node/version
# {"node":"0.18.7"}
```

### Environment

CLI flags override these when both are set. See `getConfigFromEnv('local')` in `src/lib/node/utils.ts`:

| Variable | Role |
|----------|------|
| `KEETANET_LOCAL_NODE_SEED` | Representative seed (with index) |
| `KEETANET_LOCAL_NODE_SEED_INDEX` | Seed index |
| `KEETANET_INITIAL_TRUSTED_ACCOUNT` | Public key of the initial trusted account |
| `KEETANET_LOCAL_NODE_LOG_LEVEL` | Console log level |
| `KEETANET_LOCAL_NODE_LOG_FILTER` | Log filter regex |
| `KEETANET_LOCAL_NODE_LEDGER_WRITE_MODE` | Ledger write mode |

Stop with `Ctrl+C` / `SIGTERM`.

---

## `createTestNode` (tests)

Programmatic helper for spinning up one or more in-memory representatives in Jest / Anchor-style suites:

```ts
import Account from '@keetanetwork/keetanet-node/dist/lib/account';
import { createTestNode } from '@keetanetwork/keetanet-node/dist/lib/utils/helper_testing';

const rep = Account.fromSeed(Account.generateRandomSeed(), 0);
const node = await createTestNode(rep, {
	createInitialVoteStaple: false,
	nodeConfig: { nodeAlias: 'TEST' },
	ledger: {
		/* optional overrides; Memory storage is the default */
	}
});

try {
	const api = node.config.endpoints?.api;
	/* Client.fromSimpleSingleRep / UserClient against `api` */
} finally {
	await node.stop();
}
```

### Behavior

- Picks a listenable IP/port (`127.0.0.1` or `::1`)
- Sets `endpoints.api` to `http://ip:port/api` and `endpoints.p2p` to `ws://ip:port/p2p`
- Uses `LedgerDrivers.Memory` and `KV.Memory`
- Network id is `testingNetworkId` (`0n`), alias `test`
- Always starts the HTTP API via `node.run(...)`
- Starts the P2P WebSocket **only** when `enableP2P: true`
- Optional `createInitialVoteStaple: true` mints genesis supply onto the ledger
- Optional `peerNodes` wires bootstrap peer ledgers and staple fan-out for multi-node tests

### Useful options (`CreateTestNodeOptions`)

| Option | Meaning |
|--------|---------|
| `name` | `nodeAlias` |
| `enableP2P` | Start `/p2p` WebSocket and optionally dial `peerNodes` |
| `peerNodes` | Existing `LocalNode`s to peer / bootstrap from |
| `ledger` | Partial ledger config (fees, operations, …) |
| `p2p` | Partial P2P config |
| `initialTrustedAccount` | Override trusted account (defaults to the rep) |
| `createInitialVoteStaple` | Genesis staple |
| `nodeConfig` | Other `NodeConfig` fields / `nodeOptions` |

Related helpers in the same module: `getVotesFromSingleNode`, `buildTestCertificate`, `testingNetworkId`, `findListenableBindingForTest`.

### Anchor / packaging note

Consumers often install a packed tarball as `@keetanetwork/keetanet-node`:

```bash
make do-npm-pack
# then in the consumer:
npm install --save-dev --save-exact @keetanetwork/keetanet-node@file:../node-lite/keetanetwork-keetanet-node-lite-0.18.7.tgz
```

Import paths match the published node layout under `dist/` (e.g. `dist/lib/utils/helper_testing.js`, `dist/client`).
