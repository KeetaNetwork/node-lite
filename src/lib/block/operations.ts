import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';

type ClientOps = typeof import('@keetanetwork/keetanet-client/lib/block/operations');

const BlockBuilder = lib.Block.Builder;

export const OperationType = BlockBuilder.OperationType as unknown as ClientOps['OperationType'];
export const Operation = BlockBuilder.Operation as unknown as ClientOps['Operation'];
export type {
	BlockOperations,
	BlockJSONOperations,
	BlockJSONOperation,
	IdentifierCreateArguments,
	ModifyPermissionsPrincipal
} from '@keetanetwork/keetanet-client/lib/block/operations';

function operationTypeToString(type: string | number): string {
	const typeStr = (OperationType as unknown as { [key: string | number]: string })[type];
	if (!typeStr) {
		throw(new Error(`Found invalid operation ${type}`));
	}
	return(typeStr);
}

function operationTypeToNumber(str: string): number {
	const type = (OperationType as unknown as { [key: string]: number })[str];
	if (type === undefined) {
		throw(new Error(`Found invalid operation ${str}`));
	}
	return(type);
}

export const isBlockOperation: ClientOps['isBlockOperation'] = ((input: unknown) => {
	const ops = Operation as unknown as { [key: string]: { isInstance?: (v: unknown, strict?: boolean) => boolean }};
	for (const key of Object.keys(ops)) {
		const Op = ops[key];
		if (typeof Op?.isInstance === 'function' && Op.isInstance(input, false)) {
			return(true);
		}
	}
	return(false);
}) as unknown as ClientOps['isBlockOperation'];

export const createBlockOperation: ClientOps['createBlockOperation'] = ((input: { type: string | number }) => {
	const typeStr = operationTypeToString(input.type);
	const OpClass = (Operation as unknown as { [key: string]: new (data: unknown) => unknown })[typeStr];
	return(new OpClass(input));
}) as ClientOps['createBlockOperation'];

export const ExportOperationsJSON: ClientOps['ExportOperationsJSON'] = ((operations) => {
	return(operations.map((operation) => operation.toJSON()));
}) as ClientOps['ExportOperationsJSON'];

export const ImportOperationsJSON: ClientOps['ImportOperationsJSON'] = ((operations) => {
	const newOperations = [];
	for (const operation of operations) {
		let type: string | number = (operation as { type: string | number }).type;
		if (typeof type === 'string') {
			type = operationTypeToNumber(type);
		}
		if ((OperationType as unknown as { [key: number]: string })[type as number] === undefined) {
			throw(new Error(`Invalid operation type: ${type}`));
		}
		let operationData: unknown = operation;
		if (isBlockOperation(operation)) {
			operationData = (operation as { toJSON: () => unknown }).toJSON();
		}
		newOperations.push(createBlockOperation(operationData as Parameters<ClientOps['createBlockOperation']>[0]));
	}
	return(newOperations);
}) as ClientOps['ImportOperationsJSON'];
export const BlockOperationASN1Schema: ClientOps['BlockOperationASN1Schema'] =
	new Proxy({} as ClientOps['BlockOperationASN1Schema'], {
		get() {
			throw(new Error('not implemented: BlockOperationASN1Schema is not available from the public client surface'));
		}
	});

export const ExportBlockOperations: ClientOps['ExportBlockOperations'] = ((..._ignored_args: unknown[]) => {
	throw(new Error('not implemented: ExportBlockOperations'));
}) as ClientOps['ExportBlockOperations'];

export const ImportOperationsASN1: ClientOps['ImportOperationsASN1'] = ((..._ignored_args: unknown[]) => {
	throw(new Error('not implemented: ImportOperationsASN1'));
}) as ClientOps['ImportOperationsASN1'];

type _AssertMatchesClient = AssertNever<
	| (typeof import('./operations') extends ClientOps ? never : typeof import('./operations'))
	| (ClientOps extends typeof import('./operations') ? never : ClientOps)
>;
