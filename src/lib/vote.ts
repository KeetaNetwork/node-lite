import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './utils/never';
import VoteError from './error/vote';
import Account from './account';
import { BlockHash } from './block';
import { ASN1toJS, isASN1Object, ValidateASN1 } from './utils/asn1';
import { bufferToArrayBuffer } from './utils/helper';
import { Hash } from './utils/hash';

type ClientVote = typeof import('@keetanetwork/keetanet-client/lib/vote');

const Vote = lib.Vote as ClientVote['default'];
const PossiblyExpiredVote = Object.getPrototypeOf(Vote) as ClientVote['PossiblyExpiredVote'];
type VoteStapleTesting = {
	fromVotesAndBlocksRaw: (...args: any[]) => InstanceType<ClientVote['VoteStaple']>;
	voteBlockHash: {
		fromBlockHashes: (...args: any[]) => InstanceType<ClientVote['VoteBlockHash']>;
	};
};
const VoteStaple = Vote.Staple as ClientVote['VoteStaple'] & {
	_Testing: () => VoteStapleTesting;
};
const VoteBlockBundle = Object.getPrototypeOf(VoteStaple) as ClientVote['VoteBlockBundle'];
const VoteBuilder = Vote.Builder as ClientVote['VoteBuilder'];
const BaseVoteBuilder = Object.getPrototypeOf(VoteBuilder) as ClientVote['BaseVoteBuilder'];
const VoteQuote = Vote.Quote as ClientVote['VoteQuote'];
const VoteQuoteBuilder = Vote.Quote.Builder as ClientVote['VoteQuoteBuilder'];
const VoteBlockHash = Vote.VoteBlocksHash as ClientVote['VoteBlockHash'];
const VoteBlockHashMap = Vote.VoteBlocksHash.Map as ClientVote['VoteBlockHashMap'];

type Vote = InstanceType<typeof Vote>;
type PossiblyExpiredVote = InstanceType<typeof PossiblyExpiredVote>;
type VoteStaple = InstanceType<typeof VoteStaple>;
type VoteBlockBundle = InstanceType<typeof VoteBlockBundle>;
type VoteBuilder = InstanceType<typeof VoteBuilder>;
type BaseVoteBuilder = InstanceType<typeof BaseVoteBuilder>;
type VoteQuote = InstanceType<typeof VoteQuote>;
type VoteQuoteBuilder = InstanceType<typeof VoteQuoteBuilder>;
type VoteBlockHash = InstanceType<typeof VoteBlockHash>;
type VoteBlockHashMap = InstanceType<typeof VoteBlockHashMap>;

export default Vote;
export {
	Vote,
	PossiblyExpiredVote,
	VoteStaple,
	VoteBlockBundle,
	VoteBuilder,
	BaseVoteBuilder,
	VoteQuote,
	VoteQuoteBuilder,
	VoteBlockHash,
	VoteBlockHashMap
};

export type {
	FeeAmountAndToken,
	VoteJSON,
	VoteStapleJSON
} from '@keetanetwork/keetanet-client/lib/vote';

/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
type CertificateExtensionFeeEntry = [
	boolean,
	bigint,
	{ type: 'context'; value: 0; kind: 'implicit'; contains: ArrayBuffer } | undefined,
	{ type: 'context'; value: 1; kind: 'implicit'; contains: ArrayBuffer } | undefined
];

const singleFeeEntrySchema = [
	ValidateASN1.IsBoolean,
	ValidateASN1.IsInteger,
	{ optional: { type: 'context', value: 0, kind: 'implicit', contains: ValidateASN1.IsOctetString } },
	{ optional: { type: 'context', value: 1, kind: 'implicit', contains: ValidateASN1.IsOctetString } }
];

const multipleFeeEntrySchema = {
	type: 'context' as const,
	value: 0,
	kind: 'explicit' as const,
	contains: { sequenceOf: singleFeeEntrySchema }
};

const feeExtensionSchema = {
	type: 'context' as const,
	value: 0,
	kind: 'explicit' as const,
	contains: { choice: [singleFeeEntrySchema, multipleFeeEntrySchema] }
};

const hashDataSchema = {
	type: 'context' as const,
	value: 0,
	kind: 'explicit' as const,
	contains: [
		ValidateASN1.IsOID,
		{ sequenceOf: ValidateASN1.IsOctetString }
	]
};

/**
 * Parse a set of distinguished names for a matching OID.
 */
function findRDN(input: unknown, findOID: string): string | undefined {
	if (!Array.isArray(input)) {
		throw new VoteError('VOTE_MALFORMED_FIND_RDN_INVALID_TYPE', 'internal error: DN must be a Sequence');
	}
	if (input.length === 0) {
		throw new VoteError('VOTE_MALFORMED_FIND_RDN_MUST_HAVE_ONE', 'internal error: DN must contain at least 1 entry');
	}
	for (const part of input) {
		if (part === undefined || part === null) {
			throw new VoteError('VOTE_MALFORMED_FIND_RDN_PART_WELL_FORMED', 'internal error: Each part of the RDN must be well-formed and not undefined');
		}
		if ((part as { type?: string }).type !== 'set') {
			throw new VoteError('VOTE_MALFORMED_FIND_RDN_MUST_BE_SET', 'internal error: Each part of the RDN must be a Set');
		}
		const name = (part as { name?: { type?: string; oid?: string } }).name;
		if (name === undefined || name === null) {
			throw new VoteError('VOTE_MALFORMED_FIND_RDN_PART_WELL_FORMED', 'internal error: Each part of the RDN must be well-formed');
		}
		if (name.type !== 'oid') {
			throw new VoteError('VOTE_MALFORMED_FIND_RDN_TYPE_MUST_BE_OID', 'internal error: Name of the RDN must be an OID');
		}
		if (name.oid !== findOID) {
			continue;
		}
		const value = (part as { value?: unknown }).value;
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'object' && value !== null) {
			const v = value as { type?: string; kind?: string; value?: string };
			if (v.type === 'string' && v.kind === 'utf8') {
				return v.value;
			}
		}
		throw new VoteError('VOTE_MALFORMED_FIND_RDN_PART_WELL_FORMED', 'internal error: Value of the RDN must be a string');
	}
	return undefined;
}

function blockHashesFromVote(input: { buffer: ArrayBuffer }): InstanceType<typeof BlockHash>[] {
	const blockHashInformation = ASN1toJS(input.buffer);
	if (!isASN1Object(blockHashInformation)) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_INVALID_INPUT', 'internal error: hashData extensions is not valid asn1 object');
	}
	if (blockHashInformation.type !== 'context') {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_INVALID_TYPE', 'internal error: hashData extension does not contain a context-specific tag');
	}
	if (blockHashInformation.value !== 0) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_INVALID_CONTEXT_SPECIFIC', 'internal error: hashData must begin with a context-specific tag 0');
	}
	const hashInformation = blockHashInformation.contains;
	if (!Array.isArray(hashInformation)) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_HASH_DATA_MUST_BE_SEQUENCE', 'internal error: hashData tag 0 must contain a Sequence');
	}
	if (hashInformation.length !== 2) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_NOT_TWO_ITEMS', 'internal error: hashInformation must contain exactly 2 items');
	}
	const hashAlgoOID = hashInformation[0] as { type?: string; oid?: string };
	if (typeof hashAlgoOID !== 'object' || hashAlgoOID === null || !('type' in hashAlgoOID) || !('oid' in hashAlgoOID)) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_NEEDS_OID', 'internal error: hashInformation must begin with an OID describing the hash used');
	}
	if (hashAlgoOID.type !== 'oid') {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_NEEDS_OID', 'internal error: hashInformation must begin with an OID describing the hash used');
	}
	if (hashAlgoOID.oid !== Hash.functionName) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_UNSUPPORTED_HASH_FUNC', `Unsupported hash function: ${hashAlgoOID.oid}`);
	}
	const blocksSequence = hashInformation[1];
	if (!Array.isArray(blocksSequence)) {
		throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_SECOND_MUST_BE_SEQUENCE', 'internal error: hashInformation must contain a Sequence of blocks as the second item');
	}
	const output: InstanceType<typeof BlockHash>[] = [];
	for (const block of blocksSequence) {
		if (!Buffer.isBuffer(block)) {
			throw new VoteError('VOTE_MALFORMED_HASHES_FROM_VOTE_DATA_UNSUPPORTED_HASH_TYPE', 'internal error: Each block hash must be an Octet String');
		}
		output.push(new BlockHash(block));
	}
	return output;
}

function parseSingleFeeEntry(feeData: unknown[]): {
	amount: bigint;
	payTo?: ReturnType<typeof Account.fromPublicKeyAndType>;
	token?: ReturnType<typeof Account.fromPublicKeyAndType>;
} {
	const fee: {
		amount: bigint;
		payTo?: ReturnType<typeof Account.fromPublicKeyAndType>;
		token?: ReturnType<typeof Account.fromPublicKeyAndType>;
	} = {
		amount: feeData[1] as bigint
	};
	if (fee.amount < 0n) {
		throw new VoteError('VOTE_MALFORMED_FEES_AMOUNT', 'internal error: fee amount cannot be negative');
	}
	const payToAsn1 = feeData[2] as { contains: ArrayBuffer } | undefined;
	if (payToAsn1 !== undefined) {
		const payTo = Account.fromPublicKeyAndType(Buffer.from(payToAsn1.contains));
		if (payTo.isStorage()) {
			fee.payTo = payTo;
		} else {
			try {
				fee.payTo = payTo.assertAccount();
			} catch {
				throw new VoteError('VOTE_MALFORMED_FEES_PAY_TO_INVALID', 'internal error: payTo is not an Account or Storage Address');
			}
		}
	}
	const tokenAsn1 = feeData[3] as { contains: ArrayBuffer } | undefined;
	if (tokenAsn1 !== undefined) {
		const token = Account.fromPublicKeyAndType(Buffer.from(tokenAsn1.contains));
		if (!token.isToken()) {
			throw new VoteError('VOTE_MALFORMED_FEES_TOKEN_NOT_TOKEN', 'internal error: fees extension token is not a valid token');
		}
		fee.token = token;
	}
	return fee;
}

function feeFromVote(input: Buffer | ArrayBuffer): {
	quote: boolean;
	fee: ReturnType<typeof parseSingleFeeEntry> | ReturnType<typeof parseSingleFeeEntry>[];
} {
	const feeInformationAnyJS = ASN1toJS(bufferToArrayBuffer(input as Buffer));
	// Schema typing from ValidateASN1 is recursive; bypass with any to avoid TS2589.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const feeSchemaChecker = new (ValidateASN1 as any)(feeExtensionSchema);
	let feeInformation: { contains: unknown };
	try {
		feeInformation = feeSchemaChecker.validate(feeInformationAnyJS) as { contains: unknown };
	} catch (asn1ValidateError) {
		let message = 'internal error: fee asn1 schema is not the right format';
		if (asn1ValidateError instanceof Error) {
			message = `${message}: ${asn1ValidateError.message}`;
		}
		throw new VoteError('VOTE_MALFORMED_FEES_FROM_VOTE_INVALID_INPUT', message);
	}
	const feeData = feeInformation.contains;
	if (Array.isArray(feeData)) {
		const quote = feeData[0] as boolean;
		const fee = parseSingleFeeEntry(feeData);
		return { quote, fee };
	}
	const multiFeeData = (feeData as { contains: unknown[] }).contains;
	if (multiFeeData.length === 0) {
		throw new VoteError('VOTE_MALFORMED_FEES_MULTIPLE_FEE_EMPTY', 'internal error: multiple fee entries must not be an empty array');
	}
	const feeList: ReturnType<typeof parseSingleFeeEntry>[] = [];
	let quote: boolean | undefined;
	for (const entry of multiFeeData) {
		if (!Array.isArray(entry)) {
			throw new VoteError('VOTE_MALFORMED_FEES_FROM_VOTE_INVALID_INPUT', 'internal error: each fee entry must be a Sequence');
		}
		const entryQuote = entry[0] as boolean;
		if (quote === undefined) {
			quote = entryQuote;
		} else if (quote !== entryQuote) {
			throw new VoteError('VOTE_MALFORMED_FEES_INVALID_QUOTE_VALUE', 'internal error: all fee entries must have the same quote value');
		}
		feeList.push(parseSingleFeeEntry(entry));
	}
	if (quote === undefined) {
		throw new VoteError('VOTE_MALFORMED_FEES_INVALID_QUOTE_VALUE', 'internal error: quote value should not be undefined');
	}
	return { quote, fee: feeList };
}

export const Testing = {
	findRDN,
	blockHashesFromVote,
	feeFromVote,
	/* Untyped schemas avoid ValidateASN1<Schema> TS2589 in tests */
	hashDataSchema: hashDataSchema as any,
	feeExtensionSchema: feeExtensionSchema as any
};

export type { CertificateExtensionFeeEntry };

type VoteModule = typeof import('./vote');
type VoteModulePublic = Omit<VoteModule, 'Testing' | 'CertificateExtensionFeeEntry'>;
type VoteModuleForAssert = Omit<VoteModulePublic, 'VoteStaple'> & {
	VoteStaple: ClientVote['VoteStaple'];
};

type _AssertMatchesClient = AssertNever<
	| (VoteModuleForAssert extends typeof import('@keetanetwork/keetanet-client/lib/vote') ? never : VoteModuleForAssert)
	| (typeof import('@keetanetwork/keetanet-client/lib/vote') extends VoteModuleForAssert ? never : typeof import('@keetanetwork/keetanet-client/lib/vote'))
>;
