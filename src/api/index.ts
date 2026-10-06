import type { AssertNever } from '../lib/utils/never';
import type Node from '../lib/node';
import type { JSONSerializable } from '../lib/utils/conversion';
import node from './node';
import vote from './vote';
import p2p from './p2p';

export interface APIRequest {
	node: Node;
	params: {
		[name: string]: string;
	};
	query: {
		[name: string]: string;
	};
	payload: any;
	header: {
		get: (name: string) => string | undefined;
	};
}

interface HandlerMapping {
	method: 'GET' | 'PUT' | 'POST' | 'DELETE';
	path: string;
	timeout?: boolean;
	handler: (request: APIRequest, ...args: any[]) => Promise<JSONSerializable>;
}

type HandlerMappings = HandlerMapping[];

const rootTree = {
	vote,
	node,
	p2p
};

const httpMethods = ['GET', 'PUT', 'POST', 'DELETE'] as const;

function flattenTree(tree: object, prefix: string): HandlerMappings {
	const mappings: HandlerMappings = [];
	const nested: [string, object][] = [];

	for (const [key, value] of Object.entries(tree)) {
		if ((httpMethods as readonly string[]).includes(key) && typeof value === 'function') {
			mappings.push({
				method: key as typeof httpMethods[number],
				path: prefix === '' ? '/' : prefix,
				handler: value as HandlerMapping['handler']
			});
		} else if (value !== null && typeof value === 'object') {
			nested.push([key, value as object]);
		}
	}

	for (const [key, value] of nested) {
		const segment = key === '_root' ? '' : key;
		const childPrefix = segment === ''
			? prefix
			: (prefix === '' ? `/${segment}` : `${prefix}/${segment}`);
		mappings.push(...flattenTree(value, childPrefix));
	}

	return(mappings);
}

const to_export: HandlerMappings = flattenTree(rootTree, '');
export default to_export;
export type APITree = typeof rootTree;

type ClientAPI = typeof import('@keetanetwork/keetanet-client/api');
type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends ClientAPI ? never : typeof import('./index'))
	| (ClientAPI extends typeof import('./index') ? never : ClientAPI)
>;
