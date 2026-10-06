import { lib } from '@keetanetwork/keetanet-client';

const _mod = lib.Utils.DomainSeparation;

export const KeetaNamespaceVersion = _mod.KeetaNamespaceVersion;
export const MaxNamespaceLength = _mod.MaxNamespaceLength;
export const namespacePrefixSchema = _mod.namespacePrefixSchema;
export const applyNamespace = _mod.applyNamespace;

import type { AssertNever } from './never';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./domain-separation') extends typeof import('@keetanetwork/keetanet-client/lib/utils/domain-separation') ? never : typeof import('./domain-separation'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/domain-separation') extends typeof import('./domain-separation') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/domain-separation'))
>;

