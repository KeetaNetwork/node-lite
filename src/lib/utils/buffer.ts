import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './never';

const _mod = lib.Utils.Buffer;

export const BufferStorage = _mod.BufferStorage;
export const Buffer = _mod.Buffer;
export const DecodeBase32 = _mod.DecodeBase32;
export const DecodeBase64 = _mod.DecodeBase64;
export const DecodeBase64URL = _mod.DecodeBase64URL;

type BytesIn = ArrayBuffer | Buffer | Uint8Array;

function asArrayBuffer(data: BytesIn): ArrayBuffer {
	if (data instanceof ArrayBuffer) {
		return(data);
	}
	return(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
}

/*
 * Client .d.ts takes ArrayBuffer only; tests (and Node APIs) pass Buffer.
 * Widen the public wrappers so the suite typechecks under current @types/node.
 */
export function EncodeBase32(data: BytesIn): string {
	return(_mod.EncodeBase32(asArrayBuffer(data)));
}
export function EncodeBase64(data: BytesIn): string {
	return(_mod.EncodeBase64(asArrayBuffer(data)));
}
export function EncodeBase64URL(data: BytesIn): string {
	return(_mod.EncodeBase64URL(asArrayBuffer(data)));
}
export function ZlibDeflate(data: BytesIn, options?: Parameters<typeof _mod.ZlibDeflate>[1]): ArrayBuffer {
	return(_mod.ZlibDeflate(asArrayBuffer(data), options));
}
export function ZlibDeflateAsync(data: BytesIn, options?: Parameters<typeof _mod.ZlibDeflateAsync>[1]): Promise<ArrayBuffer> {
	return(_mod.ZlibDeflateAsync(asArrayBuffer(data), options));
}
export function ZlibInflate(data: BytesIn, options?: Parameters<typeof _mod.ZlibInflate>[1]): ArrayBuffer {
	return(_mod.ZlibInflate(asArrayBuffer(data), options));
}
export function ZlibInflateAsync(data: BytesIn, options?: Parameters<typeof _mod.ZlibInflateAsync>[1]): Promise<ArrayBuffer> {
	return(_mod.ZlibInflateAsync(asArrayBuffer(data), options));
}

type ClientBuffer = typeof import('@keetanetwork/keetanet-client/lib/utils/buffer');
type LocalBuffer = typeof import('./buffer');
/*
 * Encode* and Zlib* wrappers accept Buffer|Uint8Array as well as ArrayBuffer.
 * Do not Pick the client signatures into the module assert -- that only
 * compares the client to itself. Omit them from the bidirectional check and
 * assert each local fn separately: same arity, same remaining params/return,
 * and a first arg that still accepts the client's.
 */
type Widened = 'EncodeBase32' | 'EncodeBase64' | 'EncodeBase64URL' | 'ZlibDeflate' | 'ZlibDeflateAsync' | 'ZlibInflate' | 'ZlibInflateAsync';
type TailParams<F extends (...args: never[]) => unknown> =
	Parameters<F> extends [unknown, ...infer Rest] ? Rest : [];
type WidenedFnMismatch<
	Local extends (...args: never[]) => unknown,
	Client extends (...args: never[]) => unknown
> =
	| (Parameters<Local>['length'] extends Parameters<Client>['length'] ? never : [Local, Client])
	| (Parameters<Client>['length'] extends Parameters<Local>['length'] ? never : [Local, Client])
	| (Parameters<Client>[0] extends Parameters<Local>[0] ? never : Parameters<Client>[0])
	| (TailParams<Local> extends TailParams<Client> ? never : TailParams<Local>)
	| (TailParams<Client> extends TailParams<Local> ? never : TailParams<Client>)
	| (ReturnType<Local> extends ReturnType<Client> ? never : ReturnType<Local>)
	| (ReturnType<Client> extends ReturnType<Local> ? never : ReturnType<Client>);

type BufferModulePublic = Omit<LocalBuffer, Widened>;
type ClientBufferPublic = Omit<ClientBuffer, Widened>;

type _AssertMatchesClient = AssertNever<
	| (BufferModulePublic extends ClientBufferPublic ? never : BufferModulePublic)
	| (ClientBufferPublic extends BufferModulePublic ? never : ClientBufferPublic)
>;
type _AssertWidenedEncodeBase32 = AssertNever<WidenedFnMismatch<LocalBuffer['EncodeBase32'], ClientBuffer['EncodeBase32']>>;
type _AssertWidenedEncodeBase64 = AssertNever<WidenedFnMismatch<LocalBuffer['EncodeBase64'], ClientBuffer['EncodeBase64']>>;
type _AssertWidenedEncodeBase64URL = AssertNever<WidenedFnMismatch<LocalBuffer['EncodeBase64URL'], ClientBuffer['EncodeBase64URL']>>;
type _AssertWidenedZlibDeflate = AssertNever<WidenedFnMismatch<LocalBuffer['ZlibDeflate'], ClientBuffer['ZlibDeflate']>>;
type _AssertWidenedZlibDeflateAsync = AssertNever<WidenedFnMismatch<LocalBuffer['ZlibDeflateAsync'], ClientBuffer['ZlibDeflateAsync']>>;
type _AssertWidenedZlibInflate = AssertNever<WidenedFnMismatch<LocalBuffer['ZlibInflate'], ClientBuffer['ZlibInflate']>>;
type _AssertWidenedZlibInflateAsync = AssertNever<WidenedFnMismatch<LocalBuffer['ZlibInflateAsync'], ClientBuffer['ZlibInflateAsync']>>;
