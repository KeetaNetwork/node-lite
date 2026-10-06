import type { AssertNever } from '../lib/utils/never';
import type { APIRequest } from './index';
import Account from '../lib/account';
import type { GenericAccount, TokenAddress } from '../lib/account';
import { Block, BlockHash } from '../lib/block';
import { NodeKind } from '../lib/node';
import { P2PPeerToJSO } from '../lib/p2p';
import { VoteStaple, VoteBlockHash } from '../lib/vote';
import { version } from '../version';
import KeetaNetAPIError from '../lib/error/api';
import type { LedgerSelector } from '../lib/ledger';
import type {
	AccountInfo,
	ACLRow,
	GetAllBalancesResponse,
	LedgerStatistics
} from '../lib/ledger/types';
import type { P2PSwitchStatistics } from '../lib/p2p';
import type { Endpoints } from '../config';
import { Certificate, CertificateHash } from '../lib/utils/certificate';
import { deserializeBloomFilter } from '../lib/utils/bloom';
import { validateBase64ToBuffer } from '../lib/utils/helper';

function toGenericAccount(value: string | GenericAccount): GenericAccount {
	if (typeof value === 'string') {
		return(Account.fromPublicKeyString(value));
	}
	return(value);
}

function toTokenAddress(value: string | TokenAddress): TokenAddress {
	if (typeof value === 'string') {
		return(Account.fromPublicKeyString(value).assertKeyType(Account.AccountKeyAlgorithm.TOKEN));
	}
	return(value);
}

function ledgerSelector(query: { [name: string]: string }): LedgerSelector {
	const side = query.side;
	if (side === undefined || side === '') {
		return('main');
	}
	if (side === 'main' || side === 'side' || side === 'both') {
		return(side);
	}
	throw(new KeetaNetAPIError('API_INVALID_SIDE', `Invalid ledger side: ${side}`));
}

function parseLimit(query: { [name: string]: string }, fallback = 200): number {
	const raw = query.limit;
	if (raw === undefined || raw === '') {
		return(fallback);
	}
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) {
		throw(new KeetaNetAPIError('API_LIMIT_NOT_NUMBER', 'Limit is not a number'));
	}
	if (parsed <= 0) {
		throw(new KeetaNetAPIError('API_LIMIT_NOT_GREATER_THAN_ZERO', 'Limit must be greater than zero'));
	}
	return(Math.min(Math.floor(parsed), 1000));
}

function parseAccounts(list: string | undefined): GenericAccount[] {
	if (list === undefined || list === '') {
		return([]);
	}
	return(list.split(',').filter((part) => part.length > 0).map((part) => Account.fromPublicKeyString(part)));
}

function certificateToString(certificate: Certificate): string {
	return(certificate.toPEM());
}

function intermediatesToStrings(intermediates: { getCertificates(): Certificate[] } | null): string[] | null {
	if (intermediates === null) {
		return(null);
	}
	return(intermediates.getCertificates().map(certificateToString));
}

function nodeEndpoints(request: APIRequest): Endpoints | undefined {
	const endpoints = request.node.config.endpoints;
	if (endpoints?.api === undefined || endpoints.p2p === undefined) {
		return(undefined);
	}
	return({
		api: endpoints.api,
		p2p: endpoints.p2p
	});
}

function representativeAccount(request: APIRequest, providedRep?: string): Account {
	if (providedRep !== undefined && providedRep !== '') {
		return(Account.fromPublicKeyString(providedRep).assertAccount());
	}
	const key = request.node.config.ledgerPrivateKey;
	if (key === undefined) {
		throw(new KeetaNetAPIError('API_REP_MISSING', 'Representative is not configured on this node'));
	}
	return(key.assertAccount());
}

async function getPeers(request: APIRequest): Promise<{
	peers: {
		kind: typeof NodeKind[keyof typeof NodeKind];
		key?: string;
		endpoints?: { p2p: string; api: string };
		preferUpdates?: string;
		signature?: string;
	}[];
}> {
	const peers = await request.node.switch.peers({ includeSelf: true, includeStale: true, includeUnverified: true });
	return({
		peers: peers.map((peer) => {
			const encoded = P2PPeerToJSO(peer);
			return({
				kind: peer.kind,
				key: typeof encoded.key === 'string' ? encoded.key : undefined,
				endpoints: encoded.endpoints as { p2p: string; api: string } | undefined,
				preferUpdates: typeof encoded.preferUpdates === 'string' ? encoded.preferUpdates : undefined,
				signature: typeof encoded.signature === 'string' ? encoded.signature : undefined
			});
		})
	});
}

async function publishVoteStaple(request: APIRequest, payload: {
	votesAndBlocks: string;
}): Promise<{ publish: boolean }> {
	const staple = new VoteStaple(validateBase64ToBuffer(payload.votesAndBlocks));
	const publish = await request.node.addToLedger(staple);
	return({ publish });
}

async function getNodeStats(request: APIRequest): Promise<{
	ledger: LedgerStatistics;
	switch: P2PSwitchStatistics;
}> {
	const [ledger, p2pSwitch] = await Promise.all([
		request.node.ledger.stats(),
		request.node.switch.stats()
	]);
	return({
		ledger,
		switch: p2pSwitch
	});
}

async function debugClearStats(_ignored_request: APIRequest): Promise<{ clearStats: boolean }> {
	return({ clearStats: true });
}

async function getBlockSuccessor(request: APIRequest, blockhash: string): Promise<{
	blockhash: string;
	successorBlock: null | Block;
}> {
	const successorBlock = await request.node.ledger.getBlockFromPrevious(new BlockHash(blockhash), 'main');
	return({
		blockhash,
		successorBlock
	});
}

async function getAccountPendingBlock(request: APIRequest, account: string): Promise<{
	account: string;
	block: null | Block;
}> {
	const resolved = toGenericAccount(account);
	const mainHead = await request.node.ledger.getHeadBlock(resolved, 'main');
	const block = mainHead === null
		? await request.node.ledger.getHeadBlock(resolved, 'side')
		: await request.node.ledger.getBlockFromPrevious(mainHead.hash, 'side');
	return({
		account,
		block
	});
}

async function getBlockFromIdempotent(request: APIRequest, account: string, idempotent: string): Promise<{
	block: Block | null;
}> {
	const block = await request.node.ledger.getBlockFromIdempotent(
		toGenericAccount(account),
		validateBase64ToBuffer(idempotent),
		ledgerSelector(request.query)
	);
	return({ block });
}

async function getAccountsHead(request: APIRequest, account: string | GenericAccount): Promise<{
	account: GenericAccount;
	block: null | Block;
	height: null | bigint;
}> {
	const resolved = toGenericAccount(account);
	const block = await request.node.ledger.getHeadBlock(resolved, 'main');
	if (block === null) {
		return({
			account: resolved,
			block: null,
			height: null
		});
	}
	const heights = await request.node.ledger.getAccountsBlockHeightInfo([{
		account: resolved,
		blockHash: block.hash
	}]);
	const info = heights[String(resolved.publicKeyString)];
	return({
		account: resolved,
		block,
		height: info?.height ?? null
	});
}

async function getAccountBalance(request: APIRequest, account: string | GenericAccount, token: string | TokenAddress): Promise<{
	account: GenericAccount;
	token: TokenAddress;
	balance: bigint;
}> {
	const resolved = toGenericAccount(account);
	const resolvedToken = toTokenAddress(token);
	const balance = await request.node.ledger.getBalance(resolved, resolvedToken);
	return({
		account: resolved,
		token: resolvedToken,
		balance
	});
}

async function getAllBalances(request: APIRequest, account: string | GenericAccount): Promise<{
	account: GenericAccount;
	balances: GetAllBalancesResponse;
}> {
	const resolved = toGenericAccount(account);
	const balances = await request.node.ledger.getAllBalances(resolved);
	return({
		account: resolved,
		balances
	});
}

async function getAccountCertificates(request: APIRequest, account: string): Promise<{
	account: string;
	certificates: {
		certificate: string;
		intermediates: string[] | null;
	}[];
}> {
	const certificates = await request.node.ledger.getAccountCertificates(toGenericAccount(account));
	return({
		account,
		certificates: certificates.map((entry) => ({
			certificate: certificateToString(entry.certificate),
			intermediates: intermediatesToStrings(entry.intermediates)
		}))
	});
}

async function getCertificateByHash(request: APIRequest, account: string, certificateHash: string): Promise<{
	certificate: string;
	intermediates: string[] | null;
	account: string;
} | {
	certificate: null;
	intermediates: null;
	account: string;
}> {
	const found = await request.node.ledger.getAccountCertificateByHash(
		toGenericAccount(account),
		new CertificateHash(certificateHash)
	);
	if (found === null) {
		return({
			certificate: null,
			intermediates: null,
			account
		});
	}
	return({
		certificate: certificateToString(found.certificate),
		intermediates: intermediatesToStrings(found.intermediates),
		account
	});
}

type AccountState = {
	account: GenericAccount;
	currentHeadBlock: BlockHash | null;
	currentHeadBlockHeight: bigint | null;
	representative: Account | null;
	balances: GetAllBalancesResponse;
	info: AccountInfo;
};

type AccountStateError = {
	account: string;
	error: string;
};

async function getAccountState(request: APIRequest, pubKey: string): Promise<AccountState | AccountStateError> {
	try {
		const account = toGenericAccount(pubKey);
		const [head, representative, balances, info] = await Promise.all([
			request.node.ledger.getHeadBlock(account, 'main'),
			request.node.ledger.getAccountRep(account),
			request.node.ledger.getAllBalances(account),
			request.node.ledger.getAccountInfo(account)
		]);
		let currentHeadBlockHeight: bigint | null = null;
		if (head !== null) {
			const heights = await request.node.ledger.getAccountsBlockHeightInfo([{
				account,
				blockHash: head.hash
			}]);
			currentHeadBlockHeight = heights[String(account.publicKeyString)]?.height ?? null;
		}
		return({
			account,
			currentHeadBlock: head === null ? null : head.hash,
			currentHeadBlockHeight,
			representative,
			balances,
			info
		});
	} catch (error) {
		return({
			account: pubKey,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

async function getBlockByHash(request: APIRequest, blockhash: string): Promise<{
	blockhash: string;
	block: null | Block;
}> {
	const block = await request.node.ledger.getBlock(new BlockHash(blockhash), ledgerSelector(request.query));
	return({
		blockhash,
		block
	});
}

async function getAccountStates(request: APIRequest, accounts: string): Promise<(AccountState | AccountStateError)[]> {
	const results: (AccountState | AccountStateError)[] = [];
	for (const account of parseAccounts(accounts)) {
		results.push(await getAccountState(request, String(account.publicKeyString.get())));
	}
	return(results);
}

async function listACLsByEntity(request: APIRequest, entity: string | GenericAccount): Promise<{
	permissions: ACLRow[];
}> {
	const permissions = await request.node.ledger.listACLsByEntity(toGenericAccount(entity));
	return({ permissions });
}

async function listACLsByPrincipal(request: APIRequest, principal: string | GenericAccount, entityPubKeys: string): Promise<{
	permissions: ACLRow[];
}> {
	const entities = parseAccounts(entityPubKeys ?? request.params.entityList);
	const permissions = await request.node.ledger.listACLsByPrincipal(
		toGenericAccount(principal),
		entities.length === 0 ? undefined : entities
	);
	return({ permissions });
}

async function listACLsByPrincipalWithInfo(request: APIRequest, principalPubKey: string, entityList?: string): Promise<{
	account: GenericAccount;
	access: {
		entity: GenericAccount;
		info: AccountInfo;
		balances: GetAllBalancesResponse;
		principals: ACLRow[];
	}[];
}> {
	const principal = toGenericAccount(principalPubKey);
	const requested = parseAccounts(entityList ?? request.params.entityList ?? '');
	const { permissions } = await listACLsByPrincipal(
		request,
		principal,
		requested.map((account) => account.publicKeyString.get()).join(',')
	);
	const entities = requested.length > 0
		? requested
		: [...new Map(permissions.map((row) => [row.entity.publicKeyString.get(), row.entity])).values()];
	const access = [];
	for (const groupedEntity of entities) {
		const [info, balances, { permissions: principals }] = await Promise.all([
			request.node.ledger.getAccountInfo(groupedEntity),
			request.node.ledger.getAllBalances(groupedEntity),
			listACLsByEntity(request, groupedEntity)
		]);
		access.push({
			entity: groupedEntity,
			info,
			balances,
			principals
		});
	}
	return({
		account: principal,
		access
	});
}

async function getAccountChain(request: APIRequest, account: string): Promise<{
	account: string;
	blocks: { block: Block }[];
	nextKey: BlockHash | null;
}> {
	const resolved = toGenericAccount(account);
	const limit = parseLimit(request.query);
	const start = request.query.start ?? 'HEAD';
	const end = request.query.end;
	let current: Block | null;
	if (start === 'HEAD') {
		current = await request.node.ledger.getHeadBlock(resolved, 'main');
	} else {
		current = await request.node.ledger.getBlock(new BlockHash(start), 'main');
	}
	const blocks: { block: Block }[] = [];
	while (current !== null && blocks.length < limit) {
		blocks.push({ block: current });
		if (end !== undefined && String(current.hash) === end) {
			return({
				account,
				blocks,
				nextKey: null
			});
		}
		if (current.$opening || String(current.previous) === Block.NO_PREVIOUS) {
			return({
				account,
				blocks,
				nextKey: null
			});
		}
		current = await request.node.ledger.getBlock(current.previous, 'main');
	}
	return({
		account,
		blocks,
		nextKey: current === null ? null : current.hash
	});
}

async function getAccountHistory(request: APIRequest, account?: string | unknown, startFromURL?: unknown): Promise<{
	history: {
		voteStaple: VoteStaple;
		'$id': string;
		'$timestamp': string;
	}[];
	nextKey: VoteBlockHash | null;
}> {
	let resolvedAccount: GenericAccount | null = null;
	if (typeof account === 'string' && account !== '') {
		resolvedAccount = toGenericAccount(account);
	} else if (typeof request.params.account === 'string' && request.params.account !== '') {
		resolvedAccount = toGenericAccount(request.params.account);
	}
	const startRaw = (typeof startFromURL === 'string' && startFromURL !== '')
		? startFromURL
		: (request.query.start ?? request.params.block);
	let start: VoteBlockHash | null = null;
	if (startRaw !== undefined && startRaw !== '') {
		try {
			start = new VoteBlockHash(startRaw);
		} catch {
			throw(new KeetaNetAPIError('API_INVALID_START', 'Invalid history start'));
		}
	}
	const limit = parseLimit(request.query);
	const staples = await request.node.ledger.getHistory(resolvedAccount, start, limit + 1);
	const hasMore = staples.length > limit;
	const page = hasMore ? staples.slice(0, limit) : staples;
	return({
		history: page.map((voteStaple) => ({
			voteStaple,
			'$id': String(voteStaple.blocksHash),
			'$timestamp': voteStaple.timestamp().toISOString()
		})),
		nextKey: hasMore ? page[page.length - 1].blocksHash : null
	});
}

async function getAllRepresentatives(request: APIRequest): Promise<{
	representatives: {
		representative: string;
		weight: bigint;
		endpoints: Endpoints;
	}[];
}> {
	const byKey = new Map<string, { representative: string; weight: bigint; endpoints: Endpoints }>();
	const add = async (key: Account, endpoints: Endpoints | undefined) => {
		if (endpoints?.api === undefined || endpoints.p2p === undefined) {
			return;
		}
		const representative = key.assertAccount();
		const pub = representative.publicKeyString.get();
		if (byKey.has(pub)) {
			return;
		}
		const weight = await request.node.ledger.votingPower(representative);
		byKey.set(pub, {
			representative: pub,
			weight,
			endpoints: { api: endpoints.api, p2p: endpoints.p2p }
		});
	};

	await add(representativeAccount(request), nodeEndpoints(request));

	const peers = await request.node.switch.peers({
		includeSelf: true,
		includeStale: true,
		includeUnverified: true
	});
	for (const peer of peers) {
		if (peer.kind !== NodeKind.REPRESENTATIVE || !('key' in peer) || !('endpoints' in peer)) {
			continue;
		}
		const peerRep = peer as { key: Account; endpoints: Endpoints };
		await add(peerRep.key, peerRep.endpoints);
	}

	return({ representatives: [...byKey.values()] });
}

async function getRepresentative(request: APIRequest, providedRep?: string): Promise<{
	representative: string;
	weight: bigint;
}> {
	const representative = representativeAccount(request, providedRep ?? request.params.rep);
	const weight = await request.node.ledger.votingPower(representative);
	return({
		representative: representative.publicKeyString.get(),
		weight
	});
}

async function getLedgerChecksum(request: APIRequest): Promise<{
	moment: Date;
	momentRange: number;
	checksum: bigint;
}> {
	const stats = await request.node.ledger.stats();
	let checksum = 0n;
	try {
		checksum = (await request.node.stats.getXor('ledger')).toBigInt();
	} catch {
		checksum = 0n;
	}
	return({
		moment: new Date(stats.moment),
		momentRange: stats.momentRange,
		checksum
	});
}

async function getVoteStaplesAfter(request: APIRequest): Promise<{
	voteStaples: VoteStaple[];
}> {
	const start = request.query.start;
	if (start === undefined || start === '') {
		throw(new KeetaNetAPIError('API_START_MISSING', 'Bootstrap start is required'));
	}
	if (!/^\d{4}-\d{2}-\d{2}(?:[Tt][0-9:.+-Zz]+)?$/.test(start)) {
		throw(new KeetaNetAPIError('API_INVALID_START', 'start must be an ISO8601 date'));
	}
	const moment = new Date(start);
	if (Number.isNaN(moment.getTime())) {
		throw(new KeetaNetAPIError('API_INVALID_START', 'start must be an ISO8601 date'));
	}
	const limit = request.query.limit === undefined ? undefined : parseLimit(request.query);
	let bloomFilter;
	if (request.query.bloomFilter !== undefined && request.query.bloomFilter !== '') {
		bloomFilter = deserializeBloomFilter(request.query.bloomFilter);
	}
	const voteStaples = await request.node.ledger.getVoteStaplesAfter(moment, limit, bloomFilter === undefined ? undefined : { bloomFilter });
	return({ voteStaples });
}

async function getVersion(): Promise<{ node: string }> {
	return({ node: version });
}

const node = {
	peers: {
		GET: getPeers
	},
	publish: {
		POST: publishVoteStaple
	},
	stats: {
		GET: getNodeStats
	},
	ledger: {
		clearstats: {
			GET: debugClearStats
		},
		block: {
			':blockhash': {
				GET: getBlockByHash,
				successor: {
					GET: getBlockSuccessor
				}
			}
		},
		representative: {
			GET: getRepresentative,
			':rep': {
				GET: getRepresentative
			}
		},
		representatives: {
			GET: getAllRepresentatives
		},
		history: {
			GET: getAccountHistory
		},
		account: {
			':account': {
				GET: getAccountState,
				head: {
					GET: getAccountsHead
				},
				chain: {
					GET: getAccountChain
				},
				history: {
					GET: getAccountHistory,
					start: {
						':block': {
							GET: getAccountHistory
						}
					}
				},
				balance: {
					GET: getAllBalances,
					':token': {
						GET: getAccountBalance
					}
				},
				acl: {
					granted: {
						GET: listACLsByEntity
					},
					additional: {
						GET: listACLsByPrincipalWithInfo,
						':entityList': {
							GET: listACLsByPrincipalWithInfo
						}
					},
					GET: listACLsByPrincipal,
					':entityList': {
						GET: listACLsByPrincipal
					}
				},
				certificates: {
					GET: getAccountCertificates,
					':certificateHash': {
						GET: getCertificateByHash
					}
				},
				pending: {
					GET: getAccountPendingBlock
				},
				idempotent: {
					':idempotent': {
						GET: getBlockFromIdempotent
					}
				}
			}
		},
		accounts: {
			':accounts': {
				GET: getAccountStates
			}
		},
		checksum: {
			GET: getLedgerChecksum
		}
	},
	bootstrap: {
		votes: {
			GET: getVoteStaplesAfter
		}
	},
	version: {
		GET: getVersion
	}
};

export default node;

type ClientNode = typeof import('@keetanetwork/keetanet-client/api/node');
type _AssertMatchesClient = AssertNever<
	| (typeof import('./node') extends ClientNode ? never : typeof import('./node'))
	| (ClientNode extends typeof import('./node') ? never : ClientNode)
>;
