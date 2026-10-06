import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';

type ClientBlock = typeof import('@keetanetwork/keetanet-client/lib/block');

const Block = lib.Block as ClientBlock['default'];
type Block = InstanceType<typeof Block>;
const BlockBuilder = Block.Builder as ClientBlock['BlockBuilder'];
type BlockBuilder = InstanceType<typeof BlockBuilder>;

export default Block;
export { Block, BlockBuilder };
const AdjustMethod = Block.AdjustMethod as ClientBlock['AdjustMethod'];
type AdjustMethod = ClientBlock['AdjustMethod'][keyof ClientBlock['AdjustMethod']];
export { AdjustMethod };
const BlockPurpose = Block.Purpose as ClientBlock['BlockPurpose'];
type BlockPurpose = ClientBlock['BlockPurpose'][keyof ClientBlock['BlockPurpose']];
export { BlockPurpose };
const BlockHash = Block.Hash as ClientBlock['BlockHash'];
type BlockHash = InstanceType<typeof BlockHash>;
export { BlockHash };

export const toAdjustMethod: ClientBlock['toAdjustMethod'] = ((value: unknown) => {
	const Adjust = AdjustMethod as unknown as { [k: string]: number };
	if (typeof value === 'number' && Object.values(Adjust).includes(value)) {
		return(value);
	}
	if (typeof value === 'string' && value in Adjust) {
		return(Adjust[value]);
	}
	throw(new Error(`Invalid AdjustMethod: ${String(value)}`));
}) as ClientBlock['toAdjustMethod'];

export const UnsignedBlock = class {
	constructor(..._ignored_args: unknown[]) {
		throw(new Error('not implemented: UnsignedBlock is not available from the public client surface'));
	}

	static isInstance(_ignored_obj: unknown): boolean {
		return(false);
	}
} as unknown as ClientBlock['UnsignedBlock'];

export type {
	BlockV2JSONIncomplete
} from '@keetanetwork/keetanet-client/lib/block';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends ClientBlock ? never : typeof import('./index'))
	| (ClientBlock extends typeof import('./index') ? never : ClientBlock)
>;
