import {
	Client,
	UserClient,
	blockGenerator,
	emitBlocks
} from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../lib/utils/never';
import lib from '../lib';

export { Client, UserClient, blockGenerator, emitBlocks, lib };

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/client') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/client') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/client'))
>;
