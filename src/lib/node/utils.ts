import Account from '../account';
import type { AssertNever } from '../utils/never';
type StorageAddress = import('@keetanetwork/keetanet-client/lib/account').StorageAddress;
type TokenAddress = import('@keetanetwork/keetanet-client/lib/account').TokenAddress;
type NodeConfig = import('@keetanetwork/keetanet-client/lib/node').NodeConfig;
import type LogTargetConsole from '../log/target_console';

type LogConfig = Omit<NonNullable<ConstructorParameters<typeof LogTargetConsole>[0]>, 'console'>;
type EnvConfig = Partial<Omit<NodeConfig, 'ledger'> & {
	ledger: Partial<NodeConfig['ledger']>;
} & {
	logConfig: Partial<LogConfig>;
}>;

function envPrefix(type: 'local' | 'lambda'): string {
	return(type === 'local' ? 'KEETANET_LOCAL_NODE' : 'KEETANET_LAMBDA_NODE');
}

/**
 * Read node configuration from environment variables.
 */
export function getConfigFromEnv(type: 'local' | 'lambda'): EnvConfig {
	const prefix = envPrefix(type);
	const config: EnvConfig = {
		ledger: {
			ledgerWriteMode: 'read-write'
		},
		manualPeers: []
	};

	const seed = process.env[`${prefix}_SEED`];
	const seedIndex = process.env[`${prefix}_SEED_INDEX`];
	if (seed !== undefined && seedIndex !== undefined) {
		config.ledgerPrivateKey = Account.fromSeed(seed, Number(seedIndex));
	}

	const logLevel = process.env[`${prefix}_LOG_LEVEL`];
	const logFilter = process.env[`${prefix}_LOG_FILTER`];
	if (logLevel !== undefined || logFilter !== undefined) {
		config.logConfig = {
			...(logLevel !== undefined ? { logLevel: logLevel.toUpperCase() as LogConfig['logLevel'] } : {}),
			...(logFilter !== undefined ? { filter: new RegExp(logFilter) } : {})
		};
	}

	const writeMode = process.env[`${prefix}_LEDGER_WRITE_MODE`];
	if (writeMode !== undefined) {
		config.ledger = {
			...config.ledger,
			ledgerWriteMode: writeMode as NonNullable<EnvConfig['ledger']>['ledgerWriteMode']
		};
	}

	const trusted = process.env.KEETANET_INITIAL_TRUSTED_ACCOUNT;
	if (trusted !== undefined) {
		config.initialTrustedAccount = Account.fromPublicKeyString(trusted).assertAccount();
	}

	return(config);
}

export function getFeeConfigFromEnv(type: 'local' | 'lambda'): {
	feeAccounts: (Account | StorageAddress)[];
	feeToken: TokenAddress | undefined;
	feeFunction: NodeConfig['ledger']['computeFeeFromBlocks'] | undefined;
} {
	const prefix = envPrefix(type);
	const feeSeed = process.env[`${prefix}_FEE_SEED`];
	const feeMin = process.env[`${prefix}_FEE_SEED_MIN_INDEX`];
	const feeMax = process.env[`${prefix}_FEE_SEED_MAX_INDEX`];
	const feeAccountsEnv = process.env[`${prefix}_FEE_ACCOUNTS`];

	const usingSeed = feeSeed !== undefined || feeMin !== undefined || feeMax !== undefined;
	const usingAccounts = feeAccountsEnv !== undefined;

	if (usingSeed && usingAccounts) {
		throw(new Error(`Cannot provide both ${prefix}_FEE_SEED* and ${prefix}_FEE_ACCOUNTS`));
	}

	let feeAccounts: (Account | StorageAddress)[] = [];

	if (usingSeed) {
		if (feeSeed === undefined || feeMin === undefined || feeMax === undefined) {
			throw(new Error(`Incomplete ${prefix}_FEE_SEED configuration`));
		}
		const min = Number(feeMin);
		const max = Number(feeMax);
		for (let index = min; index <= max; index++) {
			feeAccounts.push(Account.fromSeed(feeSeed, index));
		}
	} else if (usingAccounts) {
		feeAccounts = feeAccountsEnv
			.split(',')
			.map((key) => key.trim())
			.filter((key) => key.length > 0)
			.map((key) => Account.fromPublicKeyString(key) as Account | StorageAddress);
	}

	let feeToken: TokenAddress | undefined;
	const feeTokenEnv = process.env[`${prefix}_FEE_TOKEN`];
	if (feeTokenEnv !== undefined) {
		const tokenAccount = Account.fromPublicKeyString(feeTokenEnv);
		if (!tokenAccount.isToken()) {
			throw(new Error(`${prefix}_FEE_TOKEN must be a TOKEN account`));
		}
		feeToken = tokenAccount;
	}

	return({
		feeAccounts,
		feeToken,
		feeFunction: undefined
	});
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./utils') extends typeof import('@keetanetwork/keetanet-client/lib/node/utils') ? never : typeof import('./utils'))
	| (typeof import('@keetanetwork/keetanet-client/lib/node/utils') extends typeof import('./utils') ? never : typeof import('@keetanetwork/keetanet-client/lib/node/utils'))
>;
