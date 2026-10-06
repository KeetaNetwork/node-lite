import type {
	Ledger,
	LedgerConfig,
	LedgerStorageAPI,
	LedgerSelector,
	PaginatedVotes,
	GetVotesAfterOptions,
	ListACLsByEntityFilters,
	LedgerStorageTransactionBaseOptions
} from '@keetanetwork/keetanet-client/lib/ledger';
import { IdempotentKey, LedgerStorageTransactionBase } from './index';
import { LedgerStorageBase, addTimeStatistic } from './common';
import type {
	ACLRow,
	GetAllBalancesResponse,
	LedgerStatistics,
	CertificateWithIntermediates,
	AccountInfoForType
} from './types';
import type { ComputedEffectOfBlocks } from './effects';
import type { GenericAccount, IdentifierAddress, TokenAddress } from '@keetanetwork/keetanet-client/lib/account';
import type Account from '@keetanetwork/keetanet-client/lib/account';
import type { AccountKeyAlgorithm } from '@keetanetwork/keetanet-client/lib/account';
import AccountRuntime from '../account';
import type { Block, BlockHash } from '@keetanetwork/keetanet-client/lib/block';
import type { Vote as VoteType, VoteStaple, VoteBlockHash, VoteBlockHashMap } from '@keetanetwork/keetanet-client/lib/vote';
import { VoteBlockHashMap as VoteBlockHashMapRuntime } from '../vote';
import type { CertificateHash } from '@keetanetwork/keetanet-client/lib/utils/certificate';
import { AdjustMethod } from '../block';
import LedgerRequestCache from './cache';
import type { AssertNever } from '../utils/never';
import type { PublicMembers } from '../utils/static-types';
import { Stats } from '../stats';
import { Hash } from '../utils/hash';
import { KeetaNetLedgerError } from '../error/ledger';
import { Permissions } from '../permissions';

type Side = 'main' | 'side';

type InfoRow = {
	name?: string;
	description?: string;
	metadata?: string;
	supply?: bigint;
	multisigQuorum?: bigint | string;
	defaultBasePermission?: string | bigint | InstanceType<typeof Permissions.BaseSet>;
	defaultExternalPermission?: string | bigint | InstanceType<typeof Permissions.ExternalSet>;
};

type HeapEntry = {
	staple: VoteStaple;
	changes: ComputedEffectOfBlocks;
	prevHashes: Map<string, BlockHash>;
};

type MemoryState = {
	blocks: Map<string, { block: Block; side: Side }>;
	heights: Map<string, Map<string, bigint>>; // account -> blockHash -> height
	heads: Map<Side, Map<string, Block>>; // side -> account -> head block
	votesByBlock: Map<Side, Map<string, VoteType[]>>;
	votesByPrevious: Map<Side, Map<string, VoteType[]>>;
	staples: Map<Side, Map<string, VoteStaple>>;
	history: Map<string, VoteBlockHash[]>; // account|'' -> ordered staple hashes
	balances: Map<string, Map<string, bigint>>; // account -> token -> balance
	reps: Map<string, Account>;
	weights: Map<string, bigint>; // rep -> weight
	info: Map<string, InfoRow>;
	acls: ACLRow[];
	certificates: Map<string, Map<string, CertificateWithIntermediates>>;
	idempotents: Map<Side, Map<string, BlockHash>>;
	serial: bigint;
	pendingStaples: VoteStaple[];
	voteTimeline: { at: number; vote: VoteType; key: string }[];
	voteUids: Set<string>;
	heapByPrev: Map<string, Set<string>>;
	heapStorage: Map<string, HeapEntry>;
};

function emptyState(): MemoryState {
	return({
		blocks: new Map(),
		heights: new Map(),
		heads: new Map([['main', new Map()], ['side', new Map()]]),
		votesByBlock: new Map([['main', new Map()], ['side', new Map()]]),
		votesByPrevious: new Map([['main', new Map()], ['side', new Map()]]),
		staples: new Map([['main', new Map()], ['side', new Map()]]),
		history: new Map(),
		balances: new Map(),
		reps: new Map(),
		weights: new Map(),
		info: new Map(),
		acls: [],
		certificates: new Map(),
		idempotents: new Map([['main', new Map()], ['side', new Map()]]),
		serial: 1n,
		pendingStaples: [],
		voteTimeline: [],
		voteUids: new Set(),
		heapByPrev: new Map(),
		heapStorage: new Map()
	});
}

function isVoteLive(vote: VoteType, now = Date.now()): boolean {
	if (vote.$permanent) {
		return(true);
	}
	const to = vote.validityTo?.valueOf?.() ?? Number.POSITIVE_INFINITY;
	return(to >= now);
}

function filterLiveVotes(votes: VoteType[] | null | undefined): VoteType[] | null {
	if (votes === null || votes === undefined) {
		return(null);
	}
	const live = votes.filter((vote) => isVoteLive(vote));
	return(live.length > 0 ? live : null);
}

function accountKey(account: GenericAccount | string): string {
	if (typeof account === 'string') {
		return(account);
	}
	const pub = account.publicKeyString;
	if (typeof pub.get === 'function') {
		return(pub.get());
	}
	return(String(pub));
}

function principalKey(principal: ACLRow['principal'] | {
	usingCertificate: true;
	certificateHash?: unknown;
	certificate?: unknown;
	certificateAccount?: GenericAccount;
}): string {
	if (typeof principal === 'object' && principal !== null && 'publicKeyString' in principal) {
		return(String((principal as GenericAccount).publicKeyString));
	}
	if (typeof principal === 'object' && principal !== null && 'usingCertificate' in principal) {
		const certPrincipal = principal as {
			certificate?: unknown;
			certificateHash?: unknown;
			certificateAccount?: GenericAccount;
		};
		const cert = certPrincipal.certificate ?? certPrincipal.certificateHash;
		const acct = certPrincipal.certificateAccount !== undefined
			? accountKey(certPrincipal.certificateAccount)
			: '';
		return(`cert:${String(cert)}:${acct}`);
	}
	return(String(principal));
}

function sidesFrom(from: LedgerSelector): Side[] {
	if (from === 'both') {
		return(['main', 'side']);
	}
	return([from]);
}

class MemoryTransaction extends LedgerStorageTransactionBase {
	cache = new LedgerRequestCache();
	constructor(options: LedgerStorageTransactionBaseOptions) {
		super(options);
	}
}

/**
 * In-memory ledger storage for keetanet-node-lite.
 * Client types this as extending DBSqlite; lite implements LedgerStorageAPI directly.
 */
class DBMemory extends LedgerStorageBase implements LedgerStorageAPI {
	#state = emptyState();
	#config: LedgerConfig | null = null;
	#ledger: Ledger | null = null;

	constructor() {
		super();
	}

	init(config: LedgerConfig, ledger: Ledger): void {
		this.#config = config;
		this.#ledger = ledger;
		this.config = config;
		this.#state = emptyState();
	}

	async destroy(): Promise<void> {
		this.#state = emptyState();
	}

	async beginTransaction(transactionBase: LedgerStorageTransactionBaseOptions): Promise<MemoryTransaction> {
		return(new MemoryTransaction(transactionBase));
	}

	async commitTransaction(_ignored_transaction: MemoryTransaction): Promise<void> {
		/* in-memory writes are immediate */
	}

	async abortTransaction(_ignored_transaction: MemoryTransaction): Promise<void> {
		/* no rollback tracking yet */
	}

	async evaluateError(error: unknown): Promise<unknown> {
		return(error);
	}

	async delegatedWeight(_transaction: unknown, rep?: Account | InstanceType<typeof AccountRuntime.Set>): Promise<bigint> {
		if (rep === undefined) {
			let total = 0n;
			for (const w of this.#state.weights.values()) {
				total += w;
			}
			return(total);
		}
		if (AccountRuntime.Set !== undefined && rep instanceof (AccountRuntime.Set as unknown as new () => unknown)) {
			let total = 0n;
			for (const account of [...(rep as Iterable<Account>)]) {
				total += this.#state.weights.get(accountKey(account)) ?? 0n;
			}
			return(total);
		}
		return(this.#state.weights.get(accountKey(rep as Account)) ?? 0n);
	}

	async getBalance(_transaction: unknown, account: GenericAccount, token: TokenAddress): Promise<bigint> {
		return(this.#state.balances.get(accountKey(account))?.get(accountKey(token)) ?? 0n);
	}

	async getAllBalances(_transaction: unknown, account: GenericAccount): Promise<GetAllBalancesResponse> {
		const tokens = this.#state.balances.get(accountKey(account));
		if (tokens === undefined) {
			return([]);
		}
		const result: GetAllBalancesResponse = [];
		for (const [tokenKey, balance] of tokens) {
			if (balance === 0n) {
				continue;
			}
			result.push({ balance, token: AccountRuntime.fromPublicKeyString(tokenKey) as TokenAddress });
		}
		return(result);
	}

	async getAccountInfo<T extends AccountKeyAlgorithm = AccountKeyAlgorithm>(
		_transaction: unknown,
		account: Account<T> | string
	): Promise<AccountInfoForType<T>> {
		const key = accountKey(account);
		const resolved = (typeof account === 'string' ? AccountRuntime.fromPublicKeyString(account) : account) as Account<T>;
		return(this._formatAccountInfoFromRow(resolved, this.#state.info.get(key)));
	}

	async listOwners(_transaction: unknown, identifier: IdentifierAddress): Promise<GenericAccount[]> {
		const idKey = accountKey(identifier);
		return(this.#state.acls
			.filter((row) =>
				accountKey(row.entity) === idKey &&
				row.principalType === 'ACCOUNT' &&
				row.permissions.has(['OWNER'])
			)
			.map((row) => row.principal as GenericAccount));
	}

	async listACLsByPrincipal(
		_transaction: unknown,
		principal: ACLRow['principal'],
		entityList?: GenericAccount[]
	): Promise<ACLRow[]> {
		const pKey = principalKey(principal);
		const entityKeys = entityList?.map(accountKey);
		return(this.#state.acls.filter((row) => {
			if (principalKey(row.principal) !== pKey) {
				return(false);
			}
			if (entityKeys !== undefined && !entityKeys.includes(accountKey(row.entity))) {
				return(false);
			}
			return(true);
		}));
	}

	async listACLsByEntity(
		_transaction: unknown,
		entity: GenericAccount,
		options?: ListACLsByEntityFilters
	): Promise<ACLRow[]> {
		const eKey = accountKey(entity);
		return(this.#state.acls.filter((row) => {
			if (accountKey(row.entity) !== eKey) {
				return(false);
			}
			if (options?.principalType !== undefined && row.principalType !== options.principalType) {
				return(false);
			}
			return(true);
		}));
	}

	protected async adjustDefer(_transaction: unknown, input: VoteStaple): Promise<void> {
		/* Prefer #deferStaple from adjust (keeps ComputedEffectOfBlocks). */
		void input;
	}

	#deferStaple(input: VoteStaple, changes: ComputedEffectOfBlocks): void {
		const digest = Hash(Buffer.from(input.toBytes()));
		const storageHash = Buffer.from(digest).toString('hex');
		if (this.#state.heapStorage.has(storageHash)) {
			return;
		}
		const inStaple = new Set(input.blocks.map((block) => String(block.hash)));
		const prevHashes = new Map<string, BlockHash>();
		for (const block of input.blocks) {
			if (block.$opening) {
				continue;
			}
			const prevKey = String(block.previous);
			/* Only wait on predecessors outside this staple. */
			if (inStaple.has(prevKey)) {
				continue;
			}
			prevHashes.set(prevKey, block.previous as BlockHash);
		}
		this.#state.heapStorage.set(storageHash, { staple: input, changes, prevHashes });
		for (const [prevKey] of prevHashes) {
			const set = this.#state.heapByPrev.get(prevKey) ?? new Set();
			set.add(storageHash);
			this.#state.heapByPrev.set(prevKey, set);
		}
	}

	#getHeapForStaple(input: VoteStaple): Map<string, BlockHash[]> {
		const result = new Map<string, BlockHash[]>();
		for (const block of input.blocks) {
			const tip = String(block.hash);
			for (const storageHash of this.#state.heapByPrev.get(tip) ?? []) {
				if (!this.#state.heapStorage.has(storageHash)) {
					continue;
				}
				const list = result.get(storageHash) ?? [];
				list.push(block.hash);
				result.set(storageHash, list);
			}
		}
		return(result);
	}

	readonly _Testing = {
		getHeapForStaple: (_transaction: unknown, input: VoteStaple) => this.#getHeapForStaple(input)
	};

	async adjust(
		transaction: unknown,
		input: VoteStaple,
		changes: ComputedEffectOfBlocks,
		mayDefer = true,
		completedStaples = new Set<string>()
	): Promise<VoteStaple[]> {
		const blockHeights = await this.preAdjust(input, false, transaction);
		if (Object.keys(blockHeights).length === 0) {
			if (mayDefer) {
				this.#deferStaple(input, changes);
			}
			return([]);
		}

		for (const vote of input.votes) {
			const uid = String(vote.$uid ?? '');
			if (uid !== '' && this.#state.voteUids.has(uid)) {
				throw(new KeetaNetLedgerError('LEDGER_DUPLICATE_VOTE_FOUND', `Duplicate vote UID: ${uid}`));
			}
		}

		const tx = transaction as MemoryTransaction | undefined;
		const node = tx?.node ?? this.#ledger?.node;
		const timingIncreases = await addTimeStatistic(node, input.blocks, 'main', this, transaction, true);
		if (tx?.statsPending !== undefined) {
			for (const incr of timingIncreases) {
				tx.statsPending.incr(...incr);
			}
		}
		const stapleHash = String(input.blocksHash);
		this.#state.staples.get('main')!.set(stapleHash, input);

		/* Promote blocks from side → main; drop matching side staple entries. */
		this.#state.staples.get('side')!.delete(stapleHash);
		this.#state.pendingStaples = this.#state.pendingStaples.filter(
			(staple) => String(staple.blocksHash) !== stapleHash
		);

		const accountsInStaple = new Set<string>();
		for (const block of input.blocks) {
			const hash = String(block.hash);
			this.#state.blocks.set(hash, { block, side: 'main' });
			this.#state.heads.get('side')!.delete(accountKey(block.account));
			/* Keep temporary side votes; drop permanent ones for this block. */
			const sideVotes = this.#state.votesByBlock.get('side')!.get(hash);
			if (sideVotes !== undefined) {
				const temps = sideVotes.filter((vote) => !vote.$permanent);
				if (temps.length > 0) {
					this.#state.votesByBlock.get('side')!.set(hash, temps);
				} else {
					this.#state.votesByBlock.get('side')!.delete(hash);
				}
			}
			const acct = accountKey(block.account);
			const heightMap = this.#state.heights.get(acct) ?? new Map();
			const nextHeight = BigInt(heightMap.size);
			heightMap.set(hash, nextHeight);
			this.#state.heights.set(acct, heightMap);
			this.#state.heads.get('main')!.set(acct, block);
			accountsInStaple.add(acct);
			if (block.idempotent !== undefined && block.idempotent !== null) {
				const idem = IdempotentKey.fromAccountAndIdempotent(block.account, Buffer.from(block.idempotent));
				this.#state.idempotents.get('main')!.set(String(idem), block.hash);
			}
		}
		for (const effect of Object.values(changes.accounts)) {
			if (effect.type === 'ACCOUNT') {
				accountsInStaple.add(accountKey(effect.account));
			}
		}
		if (changes.touched !== undefined) {
			for (const account of changes.touched) {
				accountsInStaple.add(accountKey(account));
			}
		}
		for (const acct of accountsInStaple) {
			const hist = this.#state.history.get(acct) ?? [];
			hist.push(input.blocksHash);
			this.#state.history.set(acct, hist);
		}
		for (const vote of input.votes) {
			const uid = String(vote.$uid ?? '');
			if (uid !== '') {
				this.#state.voteUids.add(uid);
			}
			const at = vote.validityFrom.valueOf();
			const voteKey = `${String(input.blocksHash)}:${String(vote.$id ?? this.#state.voteTimeline.length)}`;
			this.#state.voteTimeline.push({ at, vote, key: voteKey });
			for (const blockHash of vote.blocks) {
				const key = String(blockHash);
				const list = this.#state.votesByBlock.get('main')!.get(key) ?? [];
				list.push(vote);
				this.#state.votesByBlock.get('main')!.set(key, list);
			}
		}
		this.#state.history.set('', [...(this.#state.history.get('') ?? []), input.blocksHash]);

		const applyPermissionUpdates = (
			updates: NonNullable<ComputedEffectOfBlocks['accounts'][string]['fields']['permissions']>
		) => {
			for (const update of updates) {
				const idx = this.#state.acls.findIndex((row) =>
					accountKey(row.entity) === accountKey(update.entity) &&
					principalKey(row.principal) === principalKey(update.principal) &&
					accountKey(row.target ?? row.entity) === accountKey(update.target ?? update.entity)
				);
				if (update.permissions === null) {
					if (idx >= 0) {
						this.#state.acls.splice(idx, 1);
					}
					continue;
				}
				let permissions = update.permissions;
				if (idx >= 0) {
					const existing = this.#state.acls[idx]!.permissions;
					if (update.method === AdjustMethod.ADD) {
						permissions = existing.combine(update.permissions);
					} else if (update.method === AdjustMethod.SUBTRACT) {
						permissions = existing.remove(update.permissions);
					}
				}
				const row = {
					entity: update.entity,
					principal: update.principal,
					principalType: update.principalType,
					target: update.target ?? update.entity,
					permissions
				} as unknown as ACLRow;
				if (idx >= 0) {
					this.#state.acls[idx] = row;
				} else {
					this.#state.acls.push(row);
				}
			}
		};

		for (const effect of Object.values(changes.accounts)) {
			if (effect.type === 'CERTIFICATE') {
				const acct = accountKey(effect.certificateAccount);
				const certMap = this.#state.certificates.get(acct) ?? new Map();
				if (effect.fields.certificate !== undefined) {
					for (const update of effect.fields.certificate) {
						const hashKey = String(update.certificateHash);
						if (update.method === AdjustMethod.SUBTRACT) {
							certMap.delete(hashKey);
						} else if ('certificate' in update) {
							certMap.set(hashKey, {
								certificate: update.certificate,
								intermediates: update.intermediateCertificates
							});
						}
					}
				}
				this.#state.certificates.set(acct, certMap);
				if (effect.fields.permissions !== undefined) {
					applyPermissionUpdates(effect.fields.permissions);
				}
				continue;
			}
			if (effect.type !== 'ACCOUNT') {
				continue;
			}
			const acct = accountKey(effect.account);
			if (effect.fields.balance !== undefined) {
				const tokenMap: Map<string, bigint> = this.#state.balances.get(acct) ?? new Map();
				for (const [tokenKey, entries] of Object.entries(effect.fields.balance)) {
					let balance: bigint = tokenMap.get(tokenKey) ?? 0n;
					for (const entry of entries) {
						/* RECEIVE entries validate pending receivables; they do not credit. */
						if (entry.isReceive) {
							continue;
						}
						if (entry.set) {
							const previous = balance;
							const next = BigInt(String(entry.value));
							balance = next;
							/*
							 * SET is a mint/burn against the token reserve. Effects omit the
							 * reserve leg; apply it here so reserve matches circulating supply.
							 */
							const delta = BigInt(next) - BigInt(previous);
							if (delta !== 0n && tokenKey !== acct) {
								const reserveMap = this.#state.balances.get(tokenKey) ?? new Map();
								reserveMap.set(tokenKey, (reserveMap.get(tokenKey) ?? 0n) - delta);
								this.#state.balances.set(tokenKey, reserveMap);
							}
						} else {
							balance += BigInt(String(entry.value));
						}
					}
					tokenMap.set(tokenKey, balance);
				}
				this.#state.balances.set(acct, tokenMap);
			}
			if (effect.fields.delegation !== undefined) {
				this.#state.reps.set(acct, effect.fields.delegation.delegateTo);
			}
			if (effect.fields.supply !== undefined) {
				const existing = this.#state.info.get(acct) ?? {};
				let supply = BigInt(existing.supply ?? 0n);
				for (const entry of effect.fields.supply) {
					supply += entry.value;
				}
				this.#state.info.set(acct, { ...existing, supply });
			}
			if (effect.fields.info !== undefined) {
				const existing = this.#state.info.get(acct) ?? {};
				const { defaultPermission, ...rest } = effect.fields.info as InfoRow & {
					defaultPermission?: InstanceType<typeof Permissions>;
				};
				const next: InfoRow = { ...existing, ...rest };
				if (defaultPermission !== undefined) {
					next.defaultBasePermission = defaultPermission.base;
					next.defaultExternalPermission = defaultPermission.external;
				}
				this.#state.info.set(acct, next);
			}
			if (effect.fields.certificate !== undefined) {
				const certMap = this.#state.certificates.get(acct) ?? new Map();
				for (const update of effect.fields.certificate) {
					const hashKey = String(update.certificateHash);
					if (update.method === AdjustMethod.SUBTRACT) {
						certMap.delete(hashKey);
					} else {
						certMap.set(hashKey, {
							certificate: update.certificate,
							intermediates: update.intermediateCertificates
						});
					}
				}
				this.#state.certificates.set(acct, certMap);
			}
			if (effect.fields.permissions !== undefined) {
				applyPermissionUpdates(effect.fields.permissions);
			}
		}

		/* Rebuild representative weights from balances of accounts that set a rep. */
		this.#state.weights.clear();
		for (const [acct, rep] of this.#state.reps) {
			const repKey = accountKey(rep);
			let weight = 0n;
			const tokens = this.#state.balances.get(acct);
			if (tokens !== undefined) {
				for (const bal of tokens.values()) {
					weight += bal;
				}
			}
			this.#state.weights.set(repKey, (this.#state.weights.get(repKey) ?? 0n) + weight);
		}

		const applied: VoteStaple[] = [input];
		const windowMs = this.#config?.heapProcessWindowMs ?? 5000;
		const deadline = Date.now() + windowMs;
		const bailed = Date.now() >= deadline;
		const matchedByStorage = new Map<string, string[]>();
		for (const block of input.blocks) {
			const tip = String(block.hash);
			for (const storageHash of this.#state.heapByPrev.get(tip) ?? []) {
				const list = matchedByStorage.get(storageHash) ?? [];
				list.push(tip);
				matchedByStorage.set(storageHash, list);
			}
		}
		for (const [storageHash, matchedTips] of matchedByStorage) {
			const entry = this.#state.heapStorage.get(storageHash);
			if (entry === undefined) {
				continue;
			}
			const allTipsReady = [...entry.prevHashes.keys()].every((prev) => {
				const blockEntry = this.#state.blocks.get(prev);
				return(blockEntry !== undefined && blockEntry.side === 'main');
			});
			if (bailed) {
				for (const tip of matchedTips) {
					entry.prevHashes.delete(tip);
					const set = this.#state.heapByPrev.get(tip);
					if (set !== undefined) {
						set.delete(storageHash);
						if (set.size === 0) {
							this.#state.heapByPrev.delete(tip);
						}
					}
				}
				if (entry.prevHashes.size === 0) {
					this.#state.heapStorage.delete(storageHash);
				}
				continue;
			}
			if (!allTipsReady || completedStaples.has(storageHash)) {
				continue;
			}
			for (const tip of [...entry.prevHashes.keys()]) {
				const set = this.#state.heapByPrev.get(tip);
				if (set !== undefined) {
					set.delete(storageHash);
					if (set.size === 0) {
						this.#state.heapByPrev.delete(tip);
					}
				}
			}
			this.#state.heapStorage.delete(storageHash);
			completedStaples.add(storageHash);
			const more = await this.adjust(transaction, entry.staple, entry.changes, false, completedStaples);
			applied.push(...more);
		}
		return(applied);
	}

	async addPendingVote(_transaction: unknown, blocksAndVote: VoteStaple): Promise<void> {
		this.#state.pendingStaples.push(blocksAndVote);
		const stapleHash = String(blocksAndVote.blocksHash);
		this.#state.staples.get('side')!.set(stapleHash, blocksAndVote);
		for (const block of blocksAndVote.blocks) {
			const hash = String(block.hash);
			this.#state.blocks.set(hash, { block, side: 'side' });
			this.#state.heads.get('side')!.set(accountKey(block.account), block);
		}
		for (const vote of blocksAndVote.votes) {
			for (const blockHash of vote.blocks) {
				const key = String(blockHash);
				const list = this.#state.votesByBlock.get('side')!.get(key) ?? [];
				list.push(vote);
				this.#state.votesByBlock.get('side')!.set(key, list);
			}
		}
	}

	async getBlock(_transaction: unknown, block: BlockHash, from: LedgerSelector): Promise<Block | null> {
		const entry = this.#state.blocks.get(String(block));
		if (entry === undefined) {
			return(null);
		}
		if (from !== 'both' && entry.side !== from) {
			return(null);
		}
		return(entry.block);
	}

	async getBlockHeight(_transaction: unknown, blockHash: BlockHash, account: GenericAccount): Promise<bigint | null> {
		return(this.#state.heights.get(accountKey(account))?.get(String(blockHash)) ?? null);
	}

	async getVotes(_transaction: unknown, block: BlockHash, from: LedgerSelector): Promise<VoteType[] | null> {
		for (const side of sidesFrom(from)) {
			const votes = filterLiveVotes(this.#state.votesByBlock.get(side)!.get(String(block)));
			if (votes !== null) {
				return(votes);
			}
		}
		return(null);
	}

	async getVoteStaples(
		_transaction: unknown,
		voteBlockHashes: VoteBlockHash[],
		from: LedgerSelector = 'main'
	): Promise<VoteBlockHashMap<VoteStaple | null>> {
		const map = new VoteBlockHashMapRuntime<VoteStaple | null>();
		for (const hash of voteBlockHashes) {
			let found: VoteStaple | null = null;
			for (const side of sidesFrom(from)) {
				const staple = this.#state.staples.get(side)!.get(String(hash));
				if (staple !== undefined) {
					found = staple;
					break;
				}
			}
			map.set(hash, found);
		}
		return(map);
	}

	async getHistory(
		_transaction: unknown,
		account: GenericAccount | null,
		start: VoteBlockHash | null,
		limit = 50
	): Promise<VoteBlockHash[]> {
		const hist = [...(this.#state.history.get(account === null ? '' : accountKey(account)) ?? [])];
		hist.sort((a, b) => {
			const stapleA = this.#state.staples.get('main')!.get(String(a));
			const stapleB = this.#state.staples.get('main')!.get(String(b));
			const timeA = stapleA?.timestamp().valueOf() ?? 0;
			const timeB = stapleB?.timestamp().valueOf() ?? 0;
			return(timeB - timeA);
		});
		let startIdx = 0;
		if (start !== null) {
			const idx = hist.findIndex((h) => String(h) === String(start));
			startIdx = idx === -1 ? 0 : idx + 1;
		}
		return(hist.slice(startIdx, startIdx + limit));
	}

	async getBlockFromPrevious(_transaction: unknown, prevBlock: BlockHash, from: LedgerSelector): Promise<Block | null> {
		const prev = String(prevBlock);
		for (const [, entry] of this.#state.blocks) {
			if (from !== 'both' && entry.side !== from) {
				continue;
			}
			if (String(entry.block.previous) !== prev) {
				continue;
			}
			if (entry.side === 'side') {
				const live = filterLiveVotes(this.#state.votesByBlock.get('side')!.get(String(entry.block.hash)));
				if (live === null) {
					continue;
				}
			}
			return(entry.block);
		}
		return(null);
	}

	async getVotesFromMultiplePrevious(
		_transaction: unknown,
		prevBlocks: BlockHash[],
		from: LedgerSelector,
		issuer?: Account
	): Promise<{ [hash: string]: VoteType[] | null }> {
		const result: { [hash: string]: VoteType[] | null } = {};
		for (const prev of prevBlocks) {
			const block = await this.getBlockFromPrevious(_transaction, prev, from);
			if (block === null) {
				result[String(prev)] = null;
				continue;
			}
			let votes = await this.getVotes(_transaction, block.hash, from);
			if (votes !== null && issuer !== undefined) {
				votes = votes.filter((vote) => vote.issuer.comparePublicKey(issuer));
				if (votes.length === 0) {
					votes = null;
				}
			}
			result[String(prev)] = votes;
		}
		return(result);
	}

	async getHeadBlocks(
		_transaction: unknown,
		accounts: GenericAccount[],
		from: LedgerSelector
	): Promise<{ [account: string]: Block | null }> {
		const result: { [account: string]: Block | null } = {};
		for (const account of accounts) {
			const key = accountKey(account);
			let head: Block | null = null;
			for (const side of sidesFrom(from)) {
				const candidate = this.#state.heads.get(side)!.get(key);
				if (candidate !== undefined) {
					head = candidate;
					if (side === 'main') {
						break;
					}
				}
			}
			result[key] = head;
		}
		return(result);
	}

	async getVotesAfter(
		_transaction: unknown,
		moment: Date,
		startKey?: string,
		options?: GetVotesAfterOptions
	): Promise<PaginatedVotes> {
		const momentMs = moment.valueOf();
		const max = options?.maxVotesPerPage ?? 200;
		const ordered = [...this.#state.voteTimeline].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
		let startIndex = 0;
		if (startKey !== undefined) {
			const found = ordered.findIndex((entry) => entry.key === startKey);
			startIndex = found >= 0 ? found + 1 : 0;
		}
		const votes: VoteType[] = [];
		let nextKey: string | undefined;
		for (let i = startIndex; i < ordered.length; i++) {
			const entry = ordered[i]!;
			if (entry.at < momentMs) {
				continue;
			}
			if (!entry.vote.$permanent) {
				continue;
			}
			votes.push(entry.vote);
			if (votes.length >= max) {
				nextKey = entry.key;
				break;
			}
		}
		return({ votes, nextKey });
	}

	async getAccountRep(_transaction: unknown, userAccount: GenericAccount | string): Promise<Account | null> {
		return(this.#state.reps.get(accountKey(userAccount)) ?? null);
	}

	async getAccountCertificates(
		_transaction: unknown,
		account: GenericAccount
	): Promise<CertificateWithIntermediates[]> {
		const map = this.#state.certificates.get(accountKey(account));
		return(map === undefined ? [] : [...map.values()]);
	}

	async getAccountCertificateByHash(
		_transaction: unknown,
		account: GenericAccount,
		hash: CertificateHash
	): Promise<CertificateWithIntermediates | null> {
		return(this.#state.certificates.get(accountKey(account))?.get(String(hash)) ?? null);
	}

	protected async gcBatch(_ignored_transaction: unknown): Promise<boolean> {
		const now = Date.now();
		let removed = false;
		const sideStaples = this.#state.staples.get('side')!;
		for (const [hash, staple] of [...sideStaples.entries()]) {
			const expired = staple.votes.every((vote) => {
				const to = vote.validityTo?.valueOf?.() ?? Number.POSITIVE_INFINITY;
				return(to < now);
			});
			if (!expired) {
				continue;
			}
			sideStaples.delete(hash);
			const expiredVoteIds = new Set(staple.votes.map((vote) => String(vote.$id)));
			for (const block of staple.blocks) {
				const key = String(block.hash);
				const sideVotes = this.#state.votesByBlock.get('side')!.get(key) ?? [];
				const kept = sideVotes.filter((vote) => !expiredVoteIds.has(String(vote.$id)) && isVoteLive(vote, now));
				if (kept.length > 0) {
					this.#state.votesByBlock.get('side')!.set(key, kept);
				} else {
					this.#state.votesByBlock.get('side')!.delete(key);
					const entry = this.#state.blocks.get(key);
					if (entry?.side === 'side') {
						this.#state.blocks.delete(key);
						const head = this.#state.heads.get('side')!.get(accountKey(block.account));
						if (head !== undefined && String(head.hash) === key) {
							this.#state.heads.get('side')!.delete(accountKey(block.account));
						}
					}
				}
			}
			removed = true;
		}
		this.#state.pendingStaples = this.#state.pendingStaples.filter((staple) =>
			sideStaples.has(String(staple.blocksHash))
		);
		return(removed);
	}

	async getNextSerialNumber(_ignored_transaction?: unknown): Promise<bigint> {
		const next = this.#state.serial;
		this.#state.serial += 1n;
		return(next);
	}

	async getIdempotentBlockHash(
		_transaction: unknown,
		idempotent: IdempotentKey,
		from: LedgerSelector,
		excludeBlockHash?: BlockHash
	): Promise<BlockHash | null> {
		const key = String(idempotent);
		for (const side of sidesFrom(from)) {
			const hash = this.#state.idempotents.get(side)!.get(key);
			if (hash !== undefined && (excludeBlockHash === undefined || String(hash) !== String(excludeBlockHash))) {
				return(hash);
			}
		}
		return(null);
	}

	async stats(): Promise<LedgerStatistics> {
		let blockCount = 0;
		let transactionCount = 0;
		for (const entry of this.#state.blocks.values()) {
			if (entry.side !== 'main') {
				continue;
			}
			blockCount += 1;
			transactionCount += entry.block.operations.length;
		}
		const node = this.#ledger?.node;
		const settlementTimes =
			node !== undefined
				? await node.stats.getTimingData('ledger', 'settlementTime')
				: Stats.placeholderTimingData();
		return({
			moment: new Date().toISOString(),
			momentRange: 0,
			blockCount,
			transactionCount,
			representativeCount: this.#state.reps.size,
			db: { retries: 0 },
			settlementTimes
		});
	}
}

type ClientDBMemory = typeof import('@keetanetwork/keetanet-client/lib/ledger/db_memory');
export default DBMemory;

type MemoryPublic = PublicMembers<InstanceType<typeof DBMemory>>;
type StoragePublic = PublicMembers<LedgerStorageAPI>;
type SharedStorageKeys = keyof MemoryPublic & keyof StoragePublic;
type _AssertMatchesClient = AssertNever<
	| (Pick<MemoryPublic, SharedStorageKeys> extends Pick<StoragePublic, SharedStorageKeys> ? never : Pick<MemoryPublic, SharedStorageKeys>)
	| (PublicMembers<InstanceType<ClientDBMemory['default']>> extends StoragePublic ? never : PublicMembers<InstanceType<ClientDBMemory['default']>>)
>;
