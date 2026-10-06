import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';
import type { VoteStaple } from '@keetanetwork/keetanet-client/lib/vote';
import type Vote from '@keetanetwork/keetanet-client/lib/vote';
import type { GenericAccount } from '@keetanetwork/keetanet-client/lib/account';
import type Account from '@keetanetwork/keetanet-client/lib/account';
import type { AccountKeyAlgorithm } from '@keetanetwork/keetanet-client/lib/account';
import { AccountKeyAlgorithm as AccountKeyAlgorithmValue } from '../account';
import type { Block, BlockHash } from '@keetanetwork/keetanet-client/lib/block';
import type { LedgerConfig, LedgerSelector, LedgerStorage, LedgerStorageAPI } from '.';
import type { AccountInfo, ACLRow, AccountInfoForType } from './types';
import type Node from '@keetanetwork/keetanet-client/lib/node';
import type Stats from '@keetanetwork/keetanet-client/lib/stats';
import { Permissions } from '../permissions';
import type { BaseSet, ExternalSet } from '../permissions';
import { computeLedgerEffectCopied } from './effects';
import { KeetaNetLedgerError } from '../error/ledger';

type ClientCommon = typeof import('@keetanetwork/keetanet-client/lib/ledger/common');

function principalKey(principal: ACLRow['principal']): string {
	if (typeof principal === 'object' && principal !== null && 'publicKeyString' in principal) {
		return(String((principal as GenericAccount).publicKeyString));
	}
	if (typeof principal === 'object' && principal !== null && 'usingCertificate' in principal) {
		const certPrincipal = principal as {
			certificate?: { toString(): string };
			certificateAccount?: GenericAccount;
		};
		const cert = certPrincipal.certificate !== undefined ? String(certPrincipal.certificate) : '';
		const acct = certPrincipal.certificateAccount !== undefined
			? String(certPrincipal.certificateAccount.publicKeyString)
			: '';
		return(`cert:${cert}:${acct}`);
	}
	return(String(principal));
}

function findPermissionMatchImpl(
	lookingFor: Pick<ACLRow, 'entity' | 'principal'> & { target?: GenericAccount },
	entries: ACLRow[]
): ACLRow | undefined {
	let wildcard: ACLRow | undefined;
	for (const entry of entries) {
		if (String(entry.entity.publicKeyString) !== String(lookingFor.entity.publicKeyString)) {
			continue;
		}
		if (principalKey(entry.principal) !== principalKey(lookingFor.principal)) {
			continue;
		}
		const target = lookingFor.target ?? lookingFor.entity;
		if (String(entry.target.publicKeyString) === String(target.publicKeyString)) {
			return(entry);
		}
		if (String(entry.target.publicKeyString) === String(lookingFor.entity.publicKeyString)) {
			wildcard = entry;
		}
	}
	return(wildcard);
}

function validateSupplyImpl(_ignored_amount: bigint, _ignored_network: bigint): void {
	/* network-specific supply bounds enforced by full node; lite accepts all */
}

function validateNumericValueImpl(
	_ignored_value: bigint,
	_ignored_block: Pick<Block, 'network' | 'date'>,
	_ignored_fieldName?: string,
	_ignored_context?: { block: Block }
): void {
	/* network-specific numeric bounds enforced by full node; lite accepts all */
}

function validateBlockSignerCountImpl(_ignored_amount: bigint, _ignored_network: bigint): void {
	/* lite accepts all signer counts */
}

function validateBlockSignerDepthImpl(_ignored_depth: bigint, _ignored_network: bigint): void {
	/* lite accepts all signer depths */
}

function canDelegateImpl(keyType: AccountKeyAlgorithm): boolean {
	switch (keyType) {
		case AccountKeyAlgorithmValue.ECDSA_SECP256K1:
		case AccountKeyAlgorithmValue.ED25519:
		case AccountKeyAlgorithmValue.ECDSA_SECP256R1:
		case AccountKeyAlgorithmValue.STORAGE:
			return(true);
		case AccountKeyAlgorithmValue.TOKEN:
		case AccountKeyAlgorithmValue.NETWORK:
		case AccountKeyAlgorithmValue.MULTISIG:
			return(false);
		default:
			return(false);
	}
}

type LedgerStorageAPILike = Pick<LedgerStorageAPI, 'getVotes'>;
type StatsIncreaseRequest = Parameters<Stats['incr']>;

async function addTimeStatisticImpl(
	node: Node | undefined,
	blocks: Block[],
	to: LedgerStorage,
	storageProvider: LedgerStorageAPILike,
	transaction?: unknown,
	skipPush = false
): Promise<StatsIncreaseRequest[]> {
	const increases: StatsIncreaseRequest[] = [];
	if (node === undefined || to !== 'main') {
		return(increases);
	}
	const ourPublicKey = node.config.ledgerPrivateKey;
	if (ourPublicKey === undefined) {
		return(increases);
	}
	const ourPublicKeyString = ourPublicKey.publicKeyString.get();
	const now = Date.now();
	const resolvedVotes = await Promise.all(
		blocks.map((block) => storageProvider.getVotes(transaction, block.hash, 'side'))
	);
	for (const checkVotes of resolvedVotes) {
		if (!checkVotes) {
			continue;
		}
		for (const toCheckVote of checkVotes) {
			if (toCheckVote.$permanent) {
				continue;
			}
			if (!toCheckVote.issuer.comparePublicKey(ourPublicKeyString)) {
				continue;
			}
			const blockVoteTime = toCheckVote.validityFrom.valueOf();
			const settlementTime = now - blockVoteTime;
			increases.push(node.stats.addTimingPoint('ledger', 'settlementTime', settlementTime, skipPush));
			break;
		}
	}
	return(increases);
}

type AccountInfoUnparsedRow = {
	name?: string;
	description?: string;
	metadata?: string;
	supply?: bigint | string;
	multisigQuorum?: bigint | string;
	defaultBasePermission?: string | bigint | BaseSet;
	defaultExternalPermission?: string | bigint | ExternalSet;
};

abstract class LedgerStorageBase {
	protected config: LedgerConfig | null = null;

	constructor() {}

	protected abstract adjustDefer(transaction: unknown, input: VoteStaple): Promise<void>;
	abstract getBlockHeight(transaction: unknown, blockHash: BlockHash, account: GenericAccount): Promise<bigint | null>;

	async getBlockHeights(
		transaction: unknown,
		toFetch: { blockHash: BlockHash; account: GenericAccount }[]
	): Promise<{ [blockHash: string]: bigint | null }> {
		const result: { [blockHash: string]: bigint | null } = {};
		for (const item of toFetch) {
			result[String(item.blockHash)] = await this.getBlockHeight(transaction, item.blockHash, item.account);
		}
		return(result);
	}

	async getAccountsBlockHeightInfo(
		transaction: unknown,
		toFetch: { account: GenericAccount; blockHash?: BlockHash }[]
	): Promise<{ [account: string]: { blockHash: BlockHash; height: bigint | null } | null }> {
		const result: { [account: string]: { blockHash: BlockHash; height: bigint | null } | null } = {};
		for (const item of toFetch) {
			const key = String(item.account.publicKeyString);
			if (item.blockHash !== undefined) {
				const height = await this.getBlockHeight(transaction, item.blockHash, item.account);
				result[key] = { blockHash: item.blockHash, height };
			} else {
				const heads = await this.getHeadBlocks(transaction, [item.account], 'main');
				const head = heads[key];
				if (head === null || head === undefined) {
					result[key] = null;
				} else {
					const height = await this.getBlockHeight(transaction, head.hash, item.account);
					result[key] = { blockHash: head.hash, height };
				}
			}
		}
		return(result);
	}

	abstract getHeadBlocks(
		transaction: unknown,
		accounts: GenericAccount[],
		from: LedgerSelector
	): Promise<{ [account: string]: Block | null }>;

	async getHeadBlockHashes(
		transaction: unknown,
		accounts: InstanceType<typeof Account.Set>
	): Promise<{ [account: string]: BlockHash | null }> {
		const list = [...accounts] as GenericAccount[];
		const heads = await this.getHeadBlocks(transaction, list, 'main');
		const result: { [account: string]: BlockHash | null } = {};
		for (const account of list) {
			const key = String(account.publicKeyString);
			const head = heads[key];
			result[key] = head?.hash ?? null;
		}
		return(result);
	}

	abstract getVotesFromMultiplePrevious(
		transaction: unknown,
		prevBlocks: BlockHash[],
		from: LedgerSelector,
		issuer?: Account
	): Promise<{ [hash: string]: Vote[] | null }>;

	async preAdjust(
		input: VoteStaple,
		mayDefer = true,
		transaction?: unknown
	): Promise<{ [hash: string]: bigint }> {
		const allBlockHeightsToFetch = input.blocks.map((block) => ({
			blockHash: block.hash,
			account: block.account
		}));
		const allBlockHeights = await this.getBlockHeights(transaction, allBlockHeightsToFetch);
		for (const [blockHash, blockHeight] of Object.entries(allBlockHeights)) {
			if (blockHeight !== null) {
				throw(new KeetaNetLedgerError(
					'LEDGER_BLOCK_ALREADY_EXISTS',
					`Block Already Exists: ${blockHash}`
				));
			}
		}
		const seenBlockHashes = new Set<string>();
		const blockHeights: { [hash: string]: bigint } = {};
		const toFetch: { blockHash: BlockHash; account: GenericAccount }[] = [];
		for (const block of input.blocks) {
			if (seenBlockHashes.has(String(block.previous))) {
				continue;
			}
			seenBlockHashes.add(String(block.hash));
			if (block.$opening) {
				blockHeights[String(block.hash)] = 0n;
			} else {
				toFetch.push({ blockHash: block.previous as BlockHash, account: block.account });
			}
		}
		const fetchedBlockHeights = await this.getBlockHeights(transaction, toFetch);
		let mustDefer = false;
		for (const block of input.blocks) {
			const blockHash = String(block.hash);
			if (blockHeights[blockHash] !== undefined) {
				continue;
			}
			const prevHash = String(block.previous);
			const prev = blockHeights[prevHash] ?? fetchedBlockHeights[prevHash];
			if (typeof prev === 'bigint') {
				blockHeights[blockHash] = prev + 1n;
				continue;
			}
			mustDefer = true;
			break;
		}
		if (mustDefer) {
			if (!mayDefer) {
				return({});
			}
			await this.adjustDefer(transaction, input);
			return({});
		}
		return(blockHeights);
	}

	_formatAccountInfoFromRow<T extends AccountKeyAlgorithm = AccountKeyAlgorithm>(
		account: Account<T>,
		row: AccountInfoUnparsedRow | undefined
	): AccountInfoForType<T>;
	_formatAccountInfoFromRow(
		account: Account<AccountKeyAlgorithm>,
		row: AccountInfoUnparsedRow | undefined = {}
	): AccountInfo {
		const shared = {
			name: row.name ?? '',
			description: row.description ?? '',
			metadata: row.metadata ?? ''
		};
		if (account.isIdentifier()) {
			const baseRaw = row.defaultBasePermission ?? 0n;
			const externalRaw = row.defaultExternalPermission ?? 0n;
			const baseSet = Permissions.BaseSet.isInstance(baseRaw) ? baseRaw : BigInt(baseRaw);
			const externalSet = Permissions.ExternalSet.isInstance(externalRaw)
				? externalRaw
				: BigInt(externalRaw);
			const identifierShared = {
				...shared,
				defaultPermission: new Permissions(baseSet, externalSet)
			};
			if (account.isToken()) {
				return({
					...identifierShared,
					account: account.assertKeyType(AccountKeyAlgorithmValue.TOKEN),
					supply: BigInt(row.supply ?? 0n)
				});
			}
			if (account.isMultisig()) {
				return({
					...identifierShared,
					account: account.assertKeyType(AccountKeyAlgorithmValue.MULTISIG),
					multisigQuorum: row.multisigQuorum !== undefined ? BigInt(row.multisigQuorum) : null
				});
			}
			if (account.isStorage()) {
				return({
					...identifierShared,
					account: account.assertKeyType(AccountKeyAlgorithmValue.STORAGE)
				});
			}
			return({
				...identifierShared,
				account: account.assertKeyType(AccountKeyAlgorithmValue.NETWORK)
			});
		}
		if (account.isKeyType(AccountKeyAlgorithmValue.ECDSA_SECP256K1)) {
			return({ ...shared, account: account.assertKeyType(AccountKeyAlgorithmValue.ECDSA_SECP256K1) });
		}
		if (account.isKeyType(AccountKeyAlgorithmValue.ECDSA_SECP256R1)) {
			return({ ...shared, account: account.assertKeyType(AccountKeyAlgorithmValue.ECDSA_SECP256R1) });
		}
		if (account.isKeyType(AccountKeyAlgorithmValue.ED25519)) {
			return({ ...shared, account: account.assertKeyType(AccountKeyAlgorithmValue.ED25519) });
		}
		throw(new Error('Unsupported account type for AccountInfo'));
	}

	_validateAccountInfoKeys(account: GenericAccount, info: Partial<AccountInfo>): void {
		const validKeys = ['name', 'description', 'metadata'];
		if (account.isIdentifier()) {
			validKeys.push('defaultPermission');
			if (account.isToken()) {
				validKeys.push('supply');
			}
			if (account.isMultisig()) {
				validKeys.push('multisigQuorum');
			}
		}
		const foundBannedKey = Object.keys(info).find((key) => !validKeys.includes(key));
		if (foundBannedKey !== undefined) {
			throw(new KeetaNetLedgerError(
				'LEDGER_INVALID_ACCOUNT_INFO_KEY',
				`Invalid AccountInfo field ${foundBannedKey}`
			));
		}
	}

	_generateNoisyTimestamp(
		_ignored_moment: Date,
		_ignored_momentBits: bigint,
		_ignored_totalLength: bigint,
		_ignored_randomData: Buffer,
		_ignored_timestampFuzzMS?: number | bigint,
		_ignored_optimistic?: boolean
	): bigint {
		throw(new Error('not implemented: LedgerStorageBase._generateNoisyTimestamp'));
	}

	async getHeadBlock(
		transaction: unknown,
		account: GenericAccount,
		from: LedgerSelector
	): Promise<Block | null> {
		const heads = await this.getHeadBlocks(transaction, [account], from);
		return(heads[String(account.publicKeyString)] ?? null);
	}

	async getVotesFromPrevious(
		transaction: unknown,
		prevBlock: BlockHash,
		from: LedgerSelector,
		issuer?: Account
	): Promise<Vote[] | null> {
		const result = await this.getVotesFromMultiplePrevious(transaction, [prevBlock], from, issuer);
		return(result[String(prevBlock)] ?? null);
	}

	protected abstract gcBatch(transaction: unknown): Promise<boolean>;

	async gc(transaction: unknown, timeLimitMS?: number): Promise<boolean> {
		const deadline = timeLimitMS === undefined ? undefined : Date.now() + timeLimitMS;
		let more = true;
		while (more) {
			if (deadline !== undefined && Date.now() >= deadline) {
				return(false);
			}
			more = await this.gcBatch(transaction);
		}
		return(true);
	}
}

function assertLedgerStorageImpl(value: string): LedgerStorage {
	if (value !== 'main' && value !== 'side') {
		throw(new Error(`Invalid LedgerStorage: ${value}`));
	}
	return(value);
}

export const findPermissionMatch: ClientCommon['findPermissionMatch'] = findPermissionMatchImpl;
export const validateSupply: ClientCommon['validateSupply'] = validateSupplyImpl;
export const validateNumericValue: ClientCommon['validateNumericValue'] = validateNumericValueImpl;
export const validateBlockSignerCount: ClientCommon['validateBlockSignerCount'] = validateBlockSignerCountImpl;
export const validateBlockSignerDepth: ClientCommon['validateBlockSignerDepth'] = validateBlockSignerDepthImpl;
export const canDelegate: ClientCommon['canDelegate'] = canDelegateImpl;
export const computeLedgerEffect: ClientCommon['computeLedgerEffect'] =
	computeLedgerEffectCopied as ClientCommon['computeLedgerEffect'];
export const addTimeStatistic: ClientCommon['addTimeStatistic'] = addTimeStatisticImpl;
export { LedgerStorageBase };
export const assertLedgerStorage: ClientCommon['assertLedgerStorage'] = assertLedgerStorageImpl;

type CommonExports = typeof import('./common');
type _AssertMatchesClient = AssertNever<
	| (Omit<CommonExports, 'LedgerStorageBase'> extends Omit<ClientCommon, 'LedgerStorageBase'> ? never : Omit<CommonExports, 'LedgerStorageBase'>)
	| (Omit<ClientCommon, 'LedgerStorageBase'> extends Omit<CommonExports, 'LedgerStorageBase'> ? never : Omit<ClientCommon, 'LedgerStorageBase'>)
	| (PublicConstructable<typeof LedgerStorageBase> extends PublicConstructable<ClientCommon['LedgerStorageBase']> ? never : PublicConstructable<typeof LedgerStorageBase>)
	| (PublicConstructable<ClientCommon['LedgerStorageBase']> extends PublicConstructable<typeof LedgerStorageBase> ? never : PublicConstructable<ClientCommon['LedgerStorageBase']>)
>;
