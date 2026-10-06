/**
 * Utility types for static type checking (mirrors client static-types.d.ts).
 * For proving our modules match the client, use AssertNever with bidirectional
 * assignability at each concrete use site (not a generic helper):
 *
 *   type _AssertMatchesClient = AssertNever<
 *     | (typeof import('./x') extends typeof import('...client.../x') ? never : typeof import('./x'))
 *     | (typeof import('...client.../x') extends typeof import('./x') ? never : typeof import('...client.../x'))
 *   >;
 *
 * Classes with `#private` are nominally typed. PublicConstructable / PublicMembers
 * compare the public surface after erasing that brand (and method `this`).
 */
import type { AssertNever } from './never';

export type Expect<T extends true> = T;
export type Equal<A, B> = A extends B ? (B extends A ? true : false) : false;

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type EraseThis<T> = T extends (...args: infer A) => infer R ? (...args: A) => R : T;

type OneLevel<T> =
	T extends Primitive ? T :
		T extends Promise<infer U> ? Promise<OneLevel<U>> :
			T extends (...args: infer A) => infer R ? (...args: A) => R :
				T extends readonly unknown[] ? T :
					T extends object ? { [K in keyof T]: EraseThis<T[K]> } :
						T;

type MapArgs<A extends readonly unknown[]> = { [I in keyof A]: OneLevel<A[I]> };

export type PublicMembers<T> = { [K in keyof T]: OneLevel<T[K]> };

export type PublicConstructable<C extends abstract new (...args: never[]) => object> =
	{ [K in keyof C as K extends 'prototype' | 'isInstance' ? never : K]:
		C[K] extends (...args: infer A) => infer R
			? (...args: A extends unknown[] ? MapArgs<A> : A) => OneLevel<R>
			: OneLevel<C[K]>
	} & {
		isInstance: (obj: unknown, strict?: boolean) => boolean;
		new (...args: ConstructorParameters<C> extends infer A extends unknown[]
			? MapArgs<A>
			: never
		): PublicMembers<InstanceType<C>>;
	};

type _AssertMatchesClient = AssertNever<
	| (typeof import('./static-types') extends typeof import('@keetanetwork/keetanet-client/lib/utils/static-types') ? never : typeof import('./static-types'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/static-types') extends typeof import('./static-types') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/static-types'))
>;
