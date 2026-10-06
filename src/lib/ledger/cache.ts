import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';
import type Vote from '@keetanetwork/keetanet-client/lib/vote';

type ClientCache = typeof import('@keetanetwork/keetanet-client/lib/ledger/cache');

function contentsKey(contents: Buffer | ArrayBuffer): string {
	const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
	return(buf.toString('hex'));
}

class LedgerRequestCache {
	#byContents = new Map<string, Vote | null>();
	#byUID = new Map<string, Vote>();

	addVote(vote: null, contents: Buffer | ArrayBuffer): null;
	addVote(vote: Vote): Vote;
	addVote(vote: Vote | null, contents?: Buffer | ArrayBuffer): Vote | null;
	addVote(vote: Vote | null, contents?: Buffer | ArrayBuffer): Vote | null {
		if (vote === null) {
			if (contents === undefined) {
				throw(new Error('contents required when vote is null'));
			}
			this.#byContents.set(contentsKey(contents), null);
			return(null);
		}
		const key = contents !== undefined ? contentsKey(contents) : contentsKey(vote.toBytes());
		this.#byContents.set(key, vote);
		this.#byUID.set(vote.$uid, vote);
		return(vote);
	}

	addVotes(votes: Vote[]): Vote[] {
		for (const vote of votes) {
			this.addVote(vote);
		}
		return(votes);
	}

	getVote(contents: Buffer | ArrayBuffer): Vote | null;
	getVote(contents: Buffer | ArrayBuffer, lookupVote: () => Vote): Vote;
	getVote(contents: Buffer | ArrayBuffer, lookupVote: () => Vote | null): Vote | null;
	getVote(contents: Buffer | ArrayBuffer, lookupVote?: () => Vote | null): Vote | null {
		const key = contentsKey(contents);
		if (this.#byContents.has(key)) {
			return(this.#byContents.get(key) ?? null);
		}
		if (lookupVote === undefined) {
			return(null);
		}
		const vote = lookupVote();
		if (vote !== null) {
			this.addVote(vote, contents);
		} else {
			this.addVote(null, contents);
		}
		return(vote);
	}

	getVoteByUID(uid: string): Vote | null {
		return(this.#byUID.get(uid) ?? null);
	}

	getVoteByContents(contents: Buffer | ArrayBuffer): Vote | null {
		return(this.#byContents.get(contentsKey(contents)) ?? null);
	}
}

export { LedgerRequestCache };
export default LedgerRequestCache;

type _AssertMatchesClient = AssertNever<
	| (PublicConstructable<typeof LedgerRequestCache> extends PublicConstructable<ClientCache['LedgerRequestCache']> ? never : PublicConstructable<typeof LedgerRequestCache>)
	| (PublicConstructable<ClientCache['LedgerRequestCache']> extends PublicConstructable<typeof LedgerRequestCache> ? never : PublicConstructable<ClientCache['LedgerRequestCache']>)
>;
