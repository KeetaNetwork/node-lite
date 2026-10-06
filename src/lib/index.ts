import Account from './account';
import Block from './block';
import Ledger from './ledger';
import Node from './node';
import P2P from './p2p';
import Stats from './stats';
import { Permissions } from './permissions';
import Vote from './vote';
import Log from './log';
import { KeetaNetError as Error } from './error';
import {
	asn1,
	ASN1CheckUtilities,
	ValidateASN1,
	BufferStorageASN1,
	ASN1toJS,
	JStoASN1,
	ASN1IntegerToBigInt,
	ASN1BigIntToBuffer,
	isASN1Object,
	isValidSequenceSchema
} from './utils/asn1';
import * as Bloom from './utils/bloom';
import * as Buffer from './utils/buffer';
import * as DomainSeparation from './utils/domain-separation';
import * as Hash from './utils/hash';
import * as Helper from './utils/helper';
import * as Initial from './utils/initial';
import * as Conversion from './utils/conversion';
import * as Certificate from './utils/certificate';

/* Build ASN1 without @internal _Testing so lib matches the published client .d.ts */
const ASN1 = {
	asn1,
	ASN1CheckUtilities,
	ValidateASN1,
	BufferStorageASN1,
	ASN1toJS,
	JStoASN1,
	ASN1IntegerToBigInt,
	ASN1BigIntToBuffer,
	isASN1Object,
	isValidSequenceSchema
};

type ClientLib = typeof import('@keetanetwork/keetanet-client').lib;

const KeetaNet: ClientLib = {
	Account,
	Block,
	Error,
	Ledger,
	Log,
	Node,
	P2P,
	Permissions,
	Stats,
	Vote,
	Utils: {
		ASN1,
		Bloom,
		Buffer,
		Certificate,
		Conversion,
		DomainSeparation,
		Hash,
		Helper,
		Initial
	}
} as ClientLib;

export default KeetaNet;
