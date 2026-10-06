import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';

import type NodeType from '@keetanetwork/keetanet-client/lib/node';

const Node = lib.Node;
type Node = NodeType;

export default Node;
export { Node };
export const NodeKind = Node.Kind;

export type {
	NodeConfig
} from '@keetanetwork/keetanet-client/lib/node';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/lib/node') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/lib/node') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/lib/node'))
>;
