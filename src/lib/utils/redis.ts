import type { AssertNever } from './never';
import { RedisClientType } from 'redis';

export { RedisClientType };

type ClientRedis = typeof import('@keetanetwork/keetanet-client/lib/utils/redis');

/**
 * Redis is not included in keetanet-node-lite.
 */
class RedisClientImpl {
	constructor(_ignored_host: string, _ignored_password: string, _ignored_port?: number) {
		throw(new Error('not implemented: RedisClient is not included in keetanet-node-lite'));
	}

	async destroy(): Promise<void> {
		throw(new Error('not implemented'));
	}

	async run<T>(_ignored_code: (conn: RedisClientType) => Promise<T>): Promise<T> {
		throw(new Error('not implemented'));
	}
}

export const RedisClient = RedisClientImpl as unknown as ClientRedis['RedisClient'];

type _AssertMatchesClient = AssertNever<
	| (typeof import('./redis') extends ClientRedis ? never : typeof import('./redis'))
	| (ClientRedis extends typeof import('./redis') ? never : ClientRedis)
>;
