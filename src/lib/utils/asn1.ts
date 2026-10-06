import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './never';

type ClientASN1 = typeof import('@keetanetwork/keetanet-client/lib/utils/asn1');
const _mod = lib.Utils.ASN1 as ClientASN1;

export const asn1: ClientASN1['asn1'] = _mod.asn1;
export const ASN1CheckUtilities: ClientASN1['ASN1CheckUtilities'] = _mod.ASN1CheckUtilities;
/*
 * Client ValidateASN1 is generic over Schema; constructing with a concrete schema
 * often hits TS2589 under ts-jest. Keep runtime from client; type as any for tests.
 */

export const ValidateASN1: any = _mod.ValidateASN1;
/** Namespace merge so `ValidateASN1.Schema` works like the client .d.ts */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ValidateASN1 {
	export type Schema = import('@keetanetwork/keetanet-client/lib/utils/asn1').ValidateASN1.Schema;
}
export const BufferStorageASN1: ClientASN1['BufferStorageASN1'] = _mod.BufferStorageASN1;
export const ASN1toJS: ClientASN1['ASN1toJS'] = _mod.ASN1toJS;
export const JStoASN1: ClientASN1['JStoASN1'] = _mod.JStoASN1;
export const ASN1IntegerToBigInt: ClientASN1['ASN1IntegerToBigInt'] = _mod.ASN1IntegerToBigInt;
export const ASN1BigIntToBuffer: ClientASN1['ASN1BigIntToBuffer'] = _mod.ASN1BigIntToBuffer;
export const isASN1Object: ClientASN1['isASN1Object'] = _mod.isASN1Object;
export const isValidSequenceSchema: ClientASN1['isValidSequenceSchema'] = _mod.isValidSequenceSchema;
/* Present on the runtime lib surface; stripped from published .d.ts as @internal */
export const _Testing = (_mod as ClientASN1 & { _Testing: unknown })._Testing as {
	native?: { JStoASN1: ClientASN1['JStoASN1']; ASN1toJS: ClientASN1['ASN1toJS'] };
	js: { JStoASN1: ClientASN1['JStoASN1']; ASN1toJS: ClientASN1['ASN1toJS'] };
};

export type {
	ASN1AnyJS,
	ASN1Struct,
	ASN1OID,
	ASN1BitString,
	ASN1String,
	ASN1Date
} from '@keetanetwork/keetanet-client/lib/utils/asn1';

type _AssertMatchesClient = AssertNever<
	| (Omit<typeof import('./asn1'), '_Testing' | 'ValidateASN1'> extends Omit<typeof import('@keetanetwork/keetanet-client/lib/utils/asn1'), 'ValidateASN1'> ? never : Omit<typeof import('./asn1'), '_Testing' | 'ValidateASN1'>)
	| (Omit<typeof import('@keetanetwork/keetanet-client/lib/utils/asn1'), 'ValidateASN1'> extends Omit<typeof import('./asn1'), '_Testing' | 'ValidateASN1'> ? never : Omit<typeof import('@keetanetwork/keetanet-client/lib/utils/asn1'), 'ValidateASN1'>)
>;
