import type { AssertNever } from '../lib/utils/never';
import type { APIRequest } from './index';
import { Block, BlockHash } from '../lib/block';
import { Vote, VoteQuote } from '../lib/vote';
import KeetaNetAPIError from '../lib/error/api';
import { assertLedgerStorage } from '../lib/ledger/common';
import type { LedgerStorage } from '../lib/ledger';
import { validateBase64ToBuffer } from '../lib/utils/helper';

function ledgerSide(query: { [name: string]: string }): LedgerStorage {
	const side = query.side;
	if (side === undefined || side === '') {
		return('main');
	}
	try {
		return(assertLedgerStorage(side));
	} catch {
		throw(new KeetaNetAPIError('API_INVALID_SIDE', `Invalid ledger side: ${side}`));
	}
}

function blocksFromPayload(payload: { blocks: string[] }): InstanceType<typeof Block>[] {
	return(payload.blocks.map(function(encoded) {
		return(new Block(validateBase64ToBuffer(encoded)));
	}));
}

async function createNewVote(request: APIRequest, payload: {
	blocks: string[];
	votes?: string[];
	quote?: string;
}): Promise<{ vote: Vote }> {
	const blocks = blocksFromPayload(payload);
	const otherVotes = payload.votes === undefined
		? undefined
		: payload.votes.map(function(encoded) {
			return(new Vote(validateBase64ToBuffer(encoded)));
		});
	const quote = payload.quote === undefined
		? undefined
		: new VoteQuote(validateBase64ToBuffer(payload.quote));
	const vote = await request.node.ledger.vote(blocks, otherVotes, quote);
	return({ vote });
}

async function getVotes(request: APIRequest, blockhash: string): Promise<{
	blockhash: BlockHash;
	votes: Vote[] | null;
}> {
	const hash = new BlockHash(blockhash);
	const votes = await request.node.ledger.getVotes(hash, ledgerSide(request.query));
	return({
		blockhash: hash,
		votes
	});
}

async function createNewQuote(request: APIRequest, payload: {
	blocks: string[];
}): Promise<{ quote: VoteQuote }> {
	const quote = await request.node.ledger.quote(blocksFromPayload(payload));
	return({ quote });
}

const vote = {
	_root: {
		POST: createNewVote
	},
	':blockhash': {
		GET: getVotes
	},
	quote: {
		POST: createNewQuote
	}
};

export default vote;

type ClientVote = typeof import('@keetanetwork/keetanet-client/api/vote');
type _AssertMatchesClient = AssertNever<
	| (typeof import('./vote') extends ClientVote ? never : typeof import('./vote'))
	| (ClientVote extends typeof import('./vote') ? never : ClientVote)
>;
