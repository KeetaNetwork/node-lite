#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createServer } from 'node:net';
import Account from './lib/account';
import LocalNode from './lib/node/local';
import type { LocalNodeConfig } from './lib/node/local';
import { NodeKind } from './lib/node';
import LedgerDrivers from './lib/ledger/drivers';
import KV from './lib/kv/providers';
import { NetworkIDs, isNetwork, getDefaultConfig } from './config';
import type { Networks } from './config';
import { generateInitialVoteStaple } from './lib/utils/initial';
import { getConfigFromEnv } from './lib/node/utils';
import Log from './lib/log';

type CliOptions = {
	host: string;
	port: number | undefined;
	seed: string | undefined;
	seedIndex: number;
	network: Networks | 'local';
	alias: string | undefined;
	p2p: boolean;
	initialStaple: boolean;
	help: boolean;
};

function printUsage(): void {
	process.stdout.write(`Usage: keetanet-node-lite [options]

Run a simple in-memory LocalNode (HTTP API + optional P2P WebSocket).

Options:
  --host <ip>           Listen address (default: 127.0.0.1)
  --port <n>            Listen port (default: ephemeral)
  --seed <hex>          Representative seed (default: random; printed)
  --seed-index <n>      Seed index (default: 0)
  --network <name>      Network alias: local | test | dev | staging | main
                        (default: local — network id 0, alias "test")
  --alias <name>        nodeAlias for logs/stats
  --p2p                 Enable the P2P WebSocket endpoint (default: on)
  --no-p2p              Disable P2P; HTTP API only
  --initial-staple      Mint a genesis vote staple onto the ledger
  --help                Show this help

Environment (merged under CLI flags; see getConfigFromEnv('local')):
  KEETANET_LOCAL_NODE_SEED
  KEETANET_LOCAL_NODE_SEED_INDEX
  KEETANET_INITIAL_TRUSTED_ACCOUNT
  KEETANET_LOCAL_NODE_LOG_LEVEL
`);
}

function parseCLI(argv: string[]): CliOptions {
	const { values } = parseArgs({
		args: argv,
		options: {
			host: { type: 'string', default: '127.0.0.1' },
			port: { type: 'string' },
			seed: { type: 'string' },
			'seed-index': { type: 'string', default: '0' },
			network: { type: 'string', default: 'local' },
			alias: { type: 'string' },
			p2p: { type: 'boolean', default: true },
			'initial-staple': { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false }
		},
		strict: true,
		allowPositionals: false,
		allowNegative: true
	});

	const networkRaw = values.network ?? 'local';
	if (networkRaw !== 'local' && !isNetwork(networkRaw)) {
		throw(new Error(`invalid --network: ${networkRaw} (expected local|test|dev|staging|main)`));
	}

	const portRaw = values.port;
	let port: number | undefined;
	if (portRaw !== undefined) {
		port = Number(portRaw);
		if (!Number.isInteger(port) || port <= 0 || port > 65535) {
			throw(new Error(`invalid --port: ${portRaw}`));
		}
	}

	const seedIndex = Number(values['seed-index'] ?? '0');
	if (!Number.isInteger(seedIndex) || seedIndex < 0) {
		throw(new Error(`invalid --seed-index: ${values['seed-index']}`));
	}

	return({
		host: values.host ?? '127.0.0.1',
		port,
		seed: values.seed,
		seedIndex,
		network: networkRaw as Networks | 'local',
		alias: values.alias,
		p2p: values.p2p ?? true,
		initialStaple: values['initial-staple'] ?? false,
		help: values.help ?? false
	});
}

async function reservePort(host: string, preferred?: number): Promise<number> {
	if (preferred !== undefined) {
		return(preferred);
	}
	return(await new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, host, () => {
			const addr = server.address();
			server.close(() => {
				if (addr === null || typeof addr === 'string') {
					reject(new Error('failed to bind ephemeral port'));
					return;
				}
				resolve(addr.port);
			});
		});
	}));
}

function resolveSeed(cli: CliOptions, envSeed: Account | undefined): {
	account: Account;
	seedHex: string | undefined;
	generated: boolean;
} {
	if (cli.seed !== undefined) {
		const account = Account.fromSeed(cli.seed, cli.seedIndex);
		return({ account, seedHex: cli.seed, generated: false });
	}
	if (envSeed?.hasPrivateKey) {
		return({ account: envSeed, seedHex: undefined, generated: false });
	}
	const seed = Account.generateRandomSeed();
	const seedHex = Buffer.from(seed).toString('hex');
	const account = Account.fromSeed(seed, cli.seedIndex);
	return({ account, seedHex, generated: true });
}

async function main(argv: string[]): Promise<void> {
	const cli = parseCLI(argv);
	if (cli.help) {
		printUsage();
		return;
	}

	const env = getConfigFromEnv('local');
	const port = await reservePort(cli.host, cli.port);
	const { account, seedHex, generated } = resolveSeed(cli, env.ledgerPrivateKey);

	let network: bigint;
	let networkAlias: Networks;
	let trusted: Account;
	if (cli.network === 'local') {
		network = 0n;
		networkAlias = 'test';
		trusted = Account.fromPublicKeyString(String(account.publicKeyString.get())).assertAccount();
	} else {
		const defaults = getDefaultConfig(cli.network);
		network = NetworkIDs[cli.network];
		networkAlias = cli.network;
		trusted = (env.initialTrustedAccount ?? defaults.initialTrustedAccount).assertAccount();
	}
	if (env.initialTrustedAccount !== undefined) {
		trusted = env.initialTrustedAccount.assertAccount();
	}

	const api = `http://${cli.host}:${port}/api`;
	const p2p = `ws://${cli.host}:${port}/p2p`;

	const log = new Log();
	log.registerConsoleTarget({
		logLevel: env.logConfig?.logLevel ?? 'INFO',
		...(env.logConfig?.filter !== undefined ? { filter: env.logConfig.filter } : {})
	});

	const config: LocalNodeConfig = {
		kind: NodeKind.REPRESENTATIVE,
		initialTrustedAccount: trusted,
		ledgerPrivateKey: account,
		network,
		networkAlias,
		endpoints: { api, p2p },
		ledger: {
			storageDriver: new LedgerDrivers.Memory(),
			computeFeeFromBlocks: () => null,
			ledgerWriteMode: env.ledger?.ledgerWriteMode ?? 'read-write',
			operations: {
				enableTokenAdminModifyBalance: true
			}
		},
		stats: {
			kv: new KV.Memory()
		},
		p2p: {},
		log,
		nodeAlias: cli.alias ?? 'lite',
		nodeOptions: {
			listenIP: cli.host,
			listenPort: port
		}
	};

	const node = new LocalNode(config);
	await node.run({ startWebSocketServer: cli.p2p });

	if (cli.initialStaple) {
		const initial = await generateInitialVoteStaple({
			network,
			initialTrustedAccount: account,
			addSupply: {
				recipient: account,
				amount: 1_000_000n,
				delegate: true,
				delegateTo: account
			}
		});
		await node.ledger.add(initial.voteStaple);
	}

	process.stdout.write(`KeetaNet node-lite listening\n`);
	process.stdout.write(`  representative: ${String(account.publicKeyString)}\n`);
	if (seedHex !== undefined) {
		process.stdout.write(`  seed: ${seedHex}${generated ? ' (generated)' : ''}\n`);
		process.stdout.write(`  seed-index: ${cli.seedIndex}\n`);
	}
	process.stdout.write(`  network: ${networkAlias} (${network})\n`);
	process.stdout.write(`  api: ${api}\n`);
	if (cli.p2p) {
		process.stdout.write(`  p2p: ${p2p}\n`);
	}
	process.stdout.write(`Press Ctrl+C to stop.\n`);

	const shutdown = async (signal: string) => {
		process.stdout.write(`\nStopping (${signal})...\n`);
		try {
			await node.stop();
		} catch (error) {
			process.stderr.write(`stop failed: ${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		}
		process.exit();
	};
	process.once('SIGINT', () => { void shutdown('SIGINT'); });
	process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
}

main(process.argv.slice(2)).catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
