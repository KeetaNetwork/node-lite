/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
import Account, { AccountKeyAlgorithm } from '../account';
import type { GenericAccount, NetworkAddress, TokenAddress } from '../account';
import { Block } from '../block';
import { OperationType } from '../block/operations';
import type { BlockOperations } from '../block/operations';
import type { OperationType as OperationTypeEnum } from '@keetanetwork/keetanet-client/lib/block/operations';
import { Permissions } from '../permissions';
import type { BaseFlagName, BaseFlagNames } from '../permissions';
import { CertificateHash } from '../utils/certificate';
import { KeetaNetLedgerError } from '../error/ledger';
import type { AssertNever } from '../utils/never';
import type {
	ComputedEffectOfBlocks,
	ComputedEffectOfBlocksByEntity
} from '@keetanetwork/keetanet-client/lib/ledger/effects';
import type { ACLPermissionRequirement, ACLUpdate } from './types';
import { canDelegate, findPermissionMatch, validateSupply } from './common';

export type {
	CertificateUpdate,
	ComputedEffectOfBlocksByEntity,
	ComputedEffectOfBlocks
} from '@keetanetwork/keetanet-client/lib/ledger/effects';

type ComputedBlockEffect = ComputedEffectOfBlocksByEntity[string];

type LedgerOptions = {
	initialTrustedAccount?: Account;
	baseToken: TokenAddress;
	networkAddress: NetworkAddress;
};

type OnlyTouchedEffects = Pick<ComputedEffectOfBlocks, 'touched' | 'possibleNewAccounts'>;

type EffectContext = {
	ledger: LedgerOptions;
	operationIndex: number;
	signedByDifferent: boolean;
	openingBlock: boolean;
};

type TouchPrincipal = GenericAccount | {
	usingCertificate: true;
	certificate: CertificateHash;
	certificateAccount: GenericAccount;
};

type AccountInfoUpdate = {
	name?: string;
	description?: string;
	metadata?: string;
	defaultPermission?: Permissions;
	multisigQuorum?: bigint | null;
};

type CombineEntry = {
	entity: GenericAccount;
	target?: GenericAccount;
	method?: number;
	permissions?: Permissions | null;
};

type BalanceState = {
	state: ComputedEffectOfBlocks;
	account: GenericAccount;
	token: TokenAddress;
	method: string;
	amount: bigint;
	otherAccount: GenericAccount;
	exact?: boolean;
	receivable?: boolean;
};

type PermissionACLPiece = {
	principal?: GenericAccount;
	entity?: GenericAccount;
	target?: GenericAccount;
	permissions?: Permissions | null;
};

type PermissionACLResult = PermissionACLPiece | PermissionACLPiece[];

type OperationHandler = {
	effectGenerator: (state: ComputedEffectOfBlocks, block: Block, operation: BlockOperations, context: EffectContext) => void;
	accountPermissionACL?: (block: Block, operation: BlockOperations, context: EffectContext) => PermissionACLResult;
	signerPermissionACL?: BaseFlagNames | ((block: Block, operation: BlockOperations, context?: EffectContext) => PermissionACLResult);
};

type Op<T extends OperationTypeEnum> = Extract<BlockOperations, { type: T }>;

type ComputeLedgerEffect = typeof import('@keetanetwork/keetanet-client/lib/ledger/common')['computeLedgerEffect'];
type ComputeLedgerEffectOptions = Parameters<ComputeLedgerEffect>[0];
type ComputeLedgerEffectStorage = Parameters<ComputeLedgerEffect>[2];

const baseBlockFeeUnit = 1000n;
/**
 * Fee Unit for an Opening Block
 */
const openingBlockFeeUnit = 10000n;
/**
 * Operation specific Fee Units
 */
const operationFeeUnitOverrides: { [K in OperationTypeEnum]: bigint } = {
    [OperationType.SEND]: 10n,
    [OperationType.SET_REP]: 20n,
    [OperationType.SET_INFO]: 100n,
    [OperationType.MODIFY_PERMISSIONS]: 20n,
    [OperationType.CREATE_IDENTIFIER]: 200n,
    [OperationType.TOKEN_ADMIN_SUPPLY]: 10n,
    [OperationType.TOKEN_ADMIN_MODIFY_BALANCE]: 10n,
    [OperationType.RECEIVE]: 10n,
    [OperationType.MANAGE_CERTIFICATE]: 100n
};
/**
 * Get the Fee Unit for a given operation type
 */
function getOperationFeeUnit(operation: OperationTypeEnum): bigint {
    return (operationFeeUnitOverrides[operation]);
}
function addOrCombineRequirements<T extends CombineEntry>(existing: T[], addition: T, alwaysCombine?: boolean): T[] {
    const resp = [...existing];
    let additionTarget;
    if (addition.target !== undefined) {
        additionTarget = addition.target.publicKeyString.get();
    }
    for (const existingInd in resp) {
        const existingPerm = resp[existingInd];
        let existingTarget;
        if (existingPerm.target !== undefined) {
            existingTarget = existingPerm.target.publicKeyString.get();
        }
        if (!existingPerm.entity.comparePublicKey(addition.entity)) {
            continue;
        }
        if (existingTarget !== additionTarget) {
            continue;
        }
        let additionMethod = addition.method;
        if (alwaysCombine) {
            additionMethod = Block.AdjustMethod.ADD;
        }
        let newPermissions;
        const existingPermissions = resp[existingInd].permissions ?? new Permissions();
        if (addition.permissions === null) {
            newPermissions = null;
        }
        else {
            switch (additionMethod) {
                case Block.AdjustMethod.SUBTRACT:
                    if (resp[existingInd].method === Block.AdjustMethod.SUBTRACT) {
                        newPermissions = existingPermissions.combine(addition.permissions!);
                    }
                    else {
                        newPermissions = existingPermissions.remove(addition.permissions!);
                    }
                    break;
                case Block.AdjustMethod.SET:
                    newPermissions = addition.permissions;
                    break;
                case Block.AdjustMethod.ADD:
                case undefined:
                    newPermissions = existingPermissions.combine(addition.permissions!);
                    break;
            }
        }
        resp[existingInd].permissions = newPermissions;
        return (resp);
    }
    resp.push(addition);
    return (resp);
}
function touchStateFields(state: ComputedEffectOfBlocks, toTouch: TouchPrincipal): { value: ComputedBlockEffect; entityKey: string } {
    let entityKey;
    let defaultValue;
    if (Account.isInstance(toTouch)) {
        entityKey = toTouch.publicKeyString.get();
        defaultValue = {
            type: 'ACCOUNT' as const,
            fields: {},
            account: toTouch
        };
    }
    else if (toTouch.usingCertificate) {
        entityKey = `${toTouch.certificate.toString()}:${toTouch.certificateAccount.publicKeyString.get()}`;
        defaultValue = {
            type: 'CERTIFICATE' as const,
            fields: {},
            certificateHash: toTouch.certificate,
            certificateAccount: toTouch.certificateAccount
        };
    }
    else {
        throw (new Error('Invalid principal type in touchStateFields'));
    }
    let value = state.accounts[entityKey];
    if (value === undefined) {
        state.accounts[entityKey] = defaultValue;
        value = state.accounts[entityKey];
    }
    return ({ value, entityKey });
}
function addPermission(state: ComputedEffectOfBlocks, addition: ACLUpdate): void {
    const { value } = touchStateFields(state, addition.principal);
    if (value.fields.permissions === undefined) {
        value.fields.permissions = [];
    }
    const existing = value.fields.permissions || [];
    value.fields.permissions = addOrCombineRequirements(existing, addition);
}
function addPermissionRequirement(state: ComputedEffectOfBlocks, requirement: ACLPermissionRequirement): void {
    const { value: principalFields } = touchStateFields(state, requirement.principal);
    const alreadyAdded = principalFields.fields.permissions ?? [];
    const foundAddedMatch = alreadyAdded.find(function ({ entity, target, permissions, method }) {
        /*
         * Only a grant that adds or sets a permission can satisfy a requirement. A
         * SUBTRACT records the removed flag in `permissions`, so ignoring the method
         * would let a removal satisfy a later requirement for that same flag.
         */
        if (method === Block.AdjustMethod.SUBTRACT) {
            return (false);
        }
        /*
         * The accumulated grant must apply to the same entity the requirement is scoped to.
         */
        if (!entity.comparePublicKey(requirement.entity)) {
            return (false);
        }
        /*
         * The grant must either target the specific target the requirement asks for, or apply
         * to the whole entity (target equal to entity) as a wildcard.
         */
        const grantTarget = target ?? entity;
        if (!grantTarget.comparePublicKey(requirement.target ?? requirement.entity) && !grantTarget.comparePublicKey(entity)) {
            return (false);
        }
        if (requirement.permissions === null) {
            return (true);
        }
        return (permissions !== null && permissions.has(requirement.permissions));
    });
    if (foundAddedMatch !== undefined) {
        return;
    }
    const entityPubKey = requirement.entity.publicKeyString.get();
    if (state.accounts[entityPubKey] !== undefined) {
        const entityInfo = state.accounts[entityPubKey].fields.info;
        if (entityInfo !== undefined && 'defaultPermission' in entityInfo) {
            const defaultPermission = entityInfo.defaultPermission;
            if (defaultPermission !== undefined) {
                if (requirement.permissions === null || defaultPermission.has(requirement.permissions)) {
                    return;
                }
            }
        }
    }
    const existing = principalFields.fields.permissionRequirements ?? [];
    principalFields.fields.permissionRequirements = addOrCombineRequirements(existing, requirement, true);
}
function updateMinSignerSetLength(state: ComputedEffectOfBlocks, multisigAccount: GenericAccount, count: bigint): void {
    const multisigPublicKey = multisigAccount.publicKeyString.get();
    if (state.accounts[multisigPublicKey] === undefined) {
        state.accounts[multisigPublicKey] = {
            type: 'ACCOUNT',
            account: multisigAccount,
            fields: {}
        };
    }
    const current = state.accounts[multisigPublicKey].fields.minSignerSetLength;
    if (current === undefined || current > count) {
        state.accounts[multisigPublicKey].fields.minSignerSetLength = count;
    }
}
function modifyBalanceInState(balanceState: BalanceState): void {
    const { state, account, token, method, amount, otherAccount } = balanceState;
    const accountPubKey = account.publicKeyString.get();
    const tokenPubKey = token.publicKeyString.get();
    if (state.accounts[accountPubKey] === undefined) {
        state.accounts[accountPubKey] = {
            type: 'ACCOUNT',
            account: Account.fromPublicKeyString(accountPubKey),
            fields: {}
        };
    }
    /**
     * Effect of balance change
     */
    let accountBalanceInfo = state.accounts[accountPubKey].fields.balance;
    if (accountBalanceInfo === undefined) {
        /**
         * Account balance info initialized to point to the same empty
         * object so that we may mutate it below
         */
        accountBalanceInfo = state.accounts[accountPubKey].fields.balance = {};
    }
    const tokenField = accountBalanceInfo[tokenPubKey] ?? [];
    if (method === 'RECEIVE') {
        if (typeof balanceState.exact !== 'boolean') {
            throw (new Error('Exact must be specified for RECEIVE operation'));
        }
        tokenField.push({
            isReceive: true,
            value: amount,
            otherAccount: otherAccount,
            exact: balanceState.exact
        });
    }
    else {
        tokenField.push({
            isReceive: false,
            value: amount,
            set: method === 'SET',
            otherAccount: otherAccount,
            receivable: balanceState.receivable === true
        });
    }
    accountBalanceInfo[tokenPubKey] = tokenField;
}
function updateAccountInfoInState(state: ComputedEffectOfBlocks, account: GenericAccount, info: AccountInfoUpdate): void {
    const accountPubKey = account.publicKeyString.get();
    let toUpdate: AccountInfoUpdate = {
        name: info.name,
        description: info.description,
        metadata: info.metadata
    };
    if (account.isIdentifier()) {
        if ('defaultPermission' in info && info.defaultPermission !== undefined) {
            toUpdate = {
                ...toUpdate,
                defaultPermission: info.defaultPermission
            };
        }
        if (account.isMultisig()) {
            if ('multisigQuorum' in info && info.multisigQuorum !== undefined) {
                toUpdate = {
                    ...toUpdate,
                    multisigQuorum: info.multisigQuorum
                };
            }
        }
    }
    else {
        state.possibleNewAccounts.add(account);
    }
    if (!state.accounts[accountPubKey]) {
        state.accounts[accountPubKey] = {
            type: 'ACCOUNT',
            account: account,
            fields: {}
        };
    }
    state.accounts[accountPubKey].fields.info = toUpdate;
}
/**
 * Compute the effect of a SEND operation
 */
function computeEffectOfOperationSEND(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.SEND>): void {
    // Decrement sender balance
    const senderChange = {
        state,
        account: block.account,
        token: operation.token,
        method: 'CHANGE',
        amount: 0n - operation.amount,
        otherAccount: operation.to,
        receivable: false
    };
    modifyBalanceInState(senderChange);
    // Increment recipient balance
    const recipientChange = {
        state,
        account: operation.to,
        token: operation.token,
        method: 'CHANGE',
        amount: operation.amount,
        otherAccount: block.account,
        receivable: true
    };
    modifyBalanceInState(recipientChange);
}
/**
 * Compute the effect of a RECEIVE operation
 */
function computeEffectOfOperationRECEIVE(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.RECEIVE>): void {
    // Increment recipient balance
    const recipientChange = {
        state,
        account: block.account,
        token: operation.token,
        method: 'RECEIVE',
        amount: operation.amount,
        otherAccount: operation.from,
        exact: operation.exact
    };
    modifyBalanceInState(recipientChange);
    if (operation.forward !== undefined) {
        const forwardAccountChange = {
            state,
            account: block.account,
            token: operation.token,
            method: 'CHANGE',
            amount: 0n - operation.amount,
            otherAccount: block.account,
            receivable: false
        };
        modifyBalanceInState(forwardAccountChange);
        const receiverChange = {
            state,
            account: operation.forward,
            token: operation.token,
            method: 'CHANGE',
            amount: operation.amount,
            otherAccount: block.account,
            receivable: true
        };
        modifyBalanceInState(receiverChange);
    }
}
function computeEffectOfOperationTOKEN_ADMIN_MODIFY_BALANCE(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.TOKEN_ADMIN_MODIFY_BALANCE>): void {
    if (operation.method === Block.AdjustMethod.SET) {
        const setChange = {
            state,
            account: block.account,
            token: operation.token,
            method: 'SET',
            amount: operation.amount,
            otherAccount: operation.token,
            receivable: true
        };
        modifyBalanceInState(setChange);
        return;
    }
    let amount = 0n;
    switch (operation.method) {
        case Block.AdjustMethod.ADD:
            amount += operation.amount;
            break;
        case Block.AdjustMethod.SUBTRACT:
            amount -= operation.amount;
            break;
    }
    const accountChange = {
        state,
        account: block.account,
        token: operation.token,
        method: 'CHANGE',
        amount: amount,
        otherAccount: operation.token,
        receivable: true
    };
    modifyBalanceInState(accountChange);
    const tokenChange = {
        state,
        account: operation.token,
        token: operation.token,
        method: 'CHANGE',
        amount: 0n - amount,
        otherAccount: operation.token,
        receivable: false
    };
    modifyBalanceInState(tokenChange);
}
/**
 * Compute the effect of a SET_REP operation
 */
function computeEffectOfOperationSET_REP(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.SET_REP>): void {
    const accountPubKey = block.account.publicKeyString.get();
    state.accounts[accountPubKey].fields.delegation = { delegateTo: operation.to };
    state.possibleNewAccounts.add(operation.to);
}
/**
 * Compute the effect of a CREATE_IDENTIFIER operation
 */
function computeEffectOfOperationCREATE_IDENTIFIER(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.CREATE_IDENTIFIER>, _ignored_context?: EffectContext): void {
    const accountPubKey = block.account.publicKeyString.get();
    if (state.accounts[accountPubKey].fields.createRequests === undefined) {
        state.accounts[accountPubKey].fields.createRequests = [];
    }
    state.possibleNewAccounts.add(operation.identifier);
    state.accounts[accountPubKey].fields.createRequests?.push({
        createdIdentifier: operation.identifier,
        createArguments: operation.createArguments
    });
    if (operation.identifier.isMultisig()) {
        if (!operation.createArguments || operation.createArguments.type !== AccountKeyAlgorithm.MULTISIG) {
            throw (new Error('Invalid identifier creation arguments'));
        }
        updateAccountInfoInState(state, operation.identifier, { multisigQuorum: operation.createArguments.quorum });
        if (operation.createArguments.quorum < 1n || operation.createArguments.quorum > BigInt(operation.createArguments.signers.length)) {
            throw (new Error('Internal error: operation.createArguments.quorum is invalid'));
        }
        for (const multisigSigner of operation.createArguments.signers) {
            state.possibleNewAccounts.add(multisigSigner);
            addPermission(state, {
                principalType: 'ACCOUNT',
                principal: multisigSigner,
                entity: operation.identifier,
                method: Block.AdjustMethod.SET,
                permissions: new Permissions(['MULTISIG_SIGNER'])
            });
        }
    }
    else {
        addPermission(state, {
            principalType: 'ACCOUNT',
            principal: block.account,
            entity: operation.identifier,
            method: Block.AdjustMethod.SET,
            permissions: new Permissions(['OWNER'])
        });
    }
}
function computeEffectOfOperationSET_INFO(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.SET_INFO>): void {
    updateAccountInfoInState(state, block.account, {
        name: operation.name,
        description: operation.description,
        metadata: operation.metadata,
        defaultPermission: operation.defaultPermission
    });
}
function computeEffectOfOperationMODIFY_PERMISSIONS(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.MODIFY_PERMISSIONS>): void {
    if (Account.isInstance(operation.principal)) {
        state.possibleNewAccounts.add(operation.principal);
    }
    else if (operation.principal.usingCertificate) {
        state.possibleNewAccounts.add(operation.principal.certificateAccount);
    }
    else {
        throw (new Error('Invalid principal in MODIFY_PERMISSIONS operation'));
    }
    if (operation.target) {
        state.possibleNewAccounts.add(operation.target);
    }
    const shared = {
        entity: block.account,
        permissions: operation.permissions,
        method: operation.method,
        target: operation.target
    };
    if (Account.isInstance(operation.principal)) {
        addPermission(state, {
            principalType: 'ACCOUNT',
            principal: operation.principal,
            ...shared
        });
    }
    else if (operation.principal.usingCertificate) {
        addPermission(state, {
            principalType: 'CERTIFICATE',
            principal: {
                usingCertificate: true,
                certificate: operation.principal.certificateHash,
                certificateAccount: operation.principal.certificateAccount
            },
            ...shared
        });
    }
    else {
        throw (new Error('Invalid principal in MODIFY_PERMISSIONS operation'));
    }
}
function computeEffectOfOperationTOKEN_ADMIN_SUPPLY(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.TOKEN_ADMIN_SUPPLY>): void {
    const tokenPubKey = block.account.publicKeyString.get();
    let value = 0n;
    switch (operation.method) {
        case Block.AdjustMethod.ADD:
            value += operation.amount;
            break;
        case Block.AdjustMethod.SUBTRACT:
            value -= operation.amount;
            break;
        default:
            throw (new Error('Invalid AdjustMethod for TOKEN_ADMIN_SUPPLY'));
    }
    const supplyField = state.accounts[tokenPubKey].fields.supply ?? [];
    supplyField.push({ value });
    state.accounts[tokenPubKey].fields.supply = supplyField;
    if (!block.account.isToken()) {
        throw (new Error('Internal error: TOKEN_ADMIN_SUPPLY called on non-token'));
    }
    const tokenSupplyChange = {
        state,
        account: block.account,
        token: block.account,
        method: 'CHANGE',
        amount: value,
        otherAccount: block.account,
        receivable: true
    };
    modifyBalanceInState(tokenSupplyChange);
}
function computeEffectOfOperationMANAGE_CERTIFICATE(state: ComputedEffectOfBlocks, block: Block, operation: Op<OperationTypeEnum.MANAGE_CERTIFICATE>, _ignored_context?: EffectContext): void {
    const publicKeyString = block.account.publicKeyString.get();
    if (state.accounts[publicKeyString].fields.certificate === undefined) {
        state.accounts[publicKeyString].fields.certificate = [];
    }
    let operationCertificateHash;
    if (CertificateHash.isInstance(operation.certificateOrHash)) {
        operationCertificateHash = operation.certificateOrHash;
    }
    else {
        operationCertificateHash = operation.certificateOrHash.hash();
    }
    let certificateUpdate;
    if (operation.method === Block.AdjustMethod.SUBTRACT) {
        certificateUpdate = {
            method: operation.method,
            certificateHash: operationCertificateHash
        };
    }
    else if (operation.method === Block.AdjustMethod.ADD) {
        if (CertificateHash.isInstance(operation.certificateOrHash)) {
            throw (new Error('Certificate must be an instance of Certificate for ADD operation'));
        }
        certificateUpdate = {
            method: operation.method,
            certificateHash: operationCertificateHash,
            certificate: operation.certificateOrHash,
            intermediateCertificates: operation.intermediateCertificates ?? null
        };
    }
    else {
        throw (new Error('Invalid AdjustMethod for MANAGE_CERTIFICATE'));
    }
    const certificateField = state.accounts[publicKeyString].fields.certificate;
    for (let i = 0; i < certificateField.length; i++) {
        const existingOperation = certificateField[i];
        const certificateMatch = existingOperation.certificateHash.compareHexString(operationCertificateHash);
        if (!certificateMatch) {
            continue;
        }
        certificateField[i] = certificateUpdate;
        return;
    }
    certificateField.push(certificateUpdate);
}
const operationHandlers = {
    [Block.OperationType.SEND]: {
        effectGenerator: computeEffectOfOperationSEND,
        accountPermissionACL: (block: Block, operation: Op<OperationTypeEnum.SEND>) => {
            const baseEffect = [
                {
                    principal: block.account,
                    entity: operation.token
                },
                {
                    principal: operation.to,
                    entity: operation.token
                }
            ];
            if (operation.to.keyType !== AccountKeyAlgorithm.STORAGE) {
                return (baseEffect);
            }
            return ([
                ...baseEffect,
                // Require that the token identifier was granted access by storage account for it to be able to hold
                {
                    entity: operation.to,
                    principal: operation.token,
                    permissions: new Permissions(['STORAGE_CAN_HOLD'])
                },
                // Require that account sending to storage account was granted access to send to it
                {
                    entity: operation.to,
                    principal: block.account,
                    permissions: new Permissions(['STORAGE_DEPOSIT']),
                    target: operation.token
                }
            ]);
        },
        signerPermissionACL: (block: Block, operation: Op<OperationTypeEnum.SEND>) => {
            return ({
                target: operation.token,
                permissions: new Permissions(['SEND_ON_BEHALF'])
            });
        }
    },
    [Block.OperationType.RECEIVE]: {
        effectGenerator: computeEffectOfOperationRECEIVE,
        accountPermissionACL: (block: Block, operation: Op<OperationTypeEnum.RECEIVE>) => {
            return ({ entity: operation.token });
        },
        signerPermissionACL: (block: Block, operation: Op<OperationTypeEnum.RECEIVE>) => {
            return ({
                target: operation.token,
                permissions: new Permissions(['SEND_ON_BEHALF'])
            });
        }
    },
    [Block.OperationType.SET_REP]: {
        effectGenerator: computeEffectOfOperationSET_REP
    },
    [Block.OperationType.CREATE_IDENTIFIER]: {
        effectGenerator: computeEffectOfOperationCREATE_IDENTIFIER,
        accountPermissionACL: (block: Block, operation: Op<OperationTypeEnum.CREATE_IDENTIFIER>, context: EffectContext) => {
            const permissionFlags: BaseFlagNames = [];
            // Different identifier accounts require different permissions to create
            switch (operation.identifier.keyType) {
                case AccountKeyAlgorithm.TOKEN:
                    permissionFlags.push('TOKEN_ADMIN_CREATE');
                    break;
                case AccountKeyAlgorithm.STORAGE:
                    permissionFlags.push('STORAGE_CREATE');
                    break;
                case AccountKeyAlgorithm.MULTISIG:
                    /* No additional permission is required to create a multisig */
                    break;
                default:
                    throw (new Error('Invalid keyType in BlockOperationCREATE_IDENTIFIER'));
            }
            return ({
                entity: context.ledger.networkAddress,
                permissions: new Permissions(permissionFlags)
            });
        }
    },
    [Block.OperationType.SET_INFO]: {
        effectGenerator: computeEffectOfOperationSET_INFO,
        signerPermissionACL: ['UPDATE_INFO']
    },
    [Block.OperationType.MODIFY_PERMISSIONS]: {
        effectGenerator: computeEffectOfOperationMODIFY_PERMISSIONS,
        signerPermissionACL: (block: Block, operation: Op<OperationTypeEnum.MODIFY_PERMISSIONS>) => {
            /**
             * If you are setting permissions, or the permissions
             * include delegate permissions, you must be owner/admin
             */
            if (operation.permissions === null) {
                return ({ permissions: new Permissions(['OWNER']) });
            }
            if (operation.method === Block.AdjustMethod.SET) {
                return ({ permissions: operation.permissions.toUpdateRequires });
            }
            const necessary = [
                {
                    permissions: operation.permissions,
                    target: operation.target
                }
            ];
            let delegateMethodNeeded: BaseFlagName;
            switch (operation.method) {
                case Block.AdjustMethod.SUBTRACT:
                    delegateMethodNeeded = 'PERMISSION_DELEGATE_REMOVE';
                    break;
                case Block.AdjustMethod.ADD:
                    delegateMethodNeeded = 'PERMISSION_DELEGATE_ADD';
                    break;
                default:
                    throw (new Error('Invalid AdjustMethod for MODIFY_PERMISSIONS signer ACL'));
            }
            let target;
            if (Account.isInstance(operation.principal)) {
                target = operation.principal;
            }
            else {
                // Currently, we do not have a way to specify a target for certificate principals, so we will not include a target in this case
                target = undefined;
            }
            necessary.push({
                permissions: new Permissions([delegateMethodNeeded]),
                target: target
            });
            return (necessary);
        }
    },
    [Block.OperationType.TOKEN_ADMIN_SUPPLY]: {
        effectGenerator: computeEffectOfOperationTOKEN_ADMIN_SUPPLY,
        signerPermissionACL: ['TOKEN_ADMIN_SUPPLY']
    },
    [Block.OperationType.TOKEN_ADMIN_MODIFY_BALANCE]: {
        effectGenerator: computeEffectOfOperationTOKEN_ADMIN_MODIFY_BALANCE,
        signerPermissionACL(block: Block, operation: Op<OperationTypeEnum.TOKEN_ADMIN_MODIFY_BALANCE>) {
            return ({
                permissions: new Permissions(['TOKEN_ADMIN_MODIFY_BALANCE']),
                entity: operation.token,
                target: block.account
            });
        }
    },
    [Block.OperationType.MANAGE_CERTIFICATE]: {
        effectGenerator: computeEffectOfOperationMANAGE_CERTIFICATE,
        signerPermissionACL: ['MANAGE_CERTIFICATE']
    }
};
function computePermissionEffect(state: ComputedEffectOfBlocks, type: 'SIGNER' | 'ACCOUNT', effect: OperationHandler['accountPermissionACL'] | OperationHandler['signerPermissionACL'], block: Block, operation: BlockOperations, context: EffectContext): void {
    const effectResults: PermissionACLPiece[] = [];
    if (typeof effect === 'function') {
        const effectResult = effect(block, operation, context);
        if (Array.isArray(effectResult)) {
            effectResults.push(...effectResult);
        }
        else {
            effectResults.push(effectResult);
        }
    }
    else {
        const permissionInstance = new Permissions(effect);
        effectResults.push({ permissions: permissionInstance });
    }
    const baseRequirement: PermissionACLPiece = {
        permissions: new Permissions(['ACCESS'])
    };
    switch (type) {
        case 'SIGNER':
            baseRequirement.principal = block.principal;
            baseRequirement.entity = block.account;
            break;
        case 'ACCOUNT':
            baseRequirement.principal = block.account;
            break;
    }
    for (const effectResult of effectResults) {
        const requirement = {
            ...baseRequirement,
            ...effectResult
        };
        if (requirement.entity === undefined) {
            throw (new Error('Error computing permission effect: Entity cannot be undefined'));
        }
        if (requirement.principal === undefined) {
            throw (new Error('Error computing permission effect: Principal cannot be undefined'));
        }
        if (requirement.permissions === undefined || requirement.permissions === null) {
            throw (new Error('Error computing permission effect: Permissions cannot be undefined'));
        }
        if (requirement.entity.comparePublicKey(requirement.principal)) {
            continue;
        }
        /**
         * The initialTrustedAccount is able to bypass all permission requirements signing opening blocks for the networkAddress and the baseToken
         * All blocks after this it does not bypass any requirements
         */
        if (context.ledger.initialTrustedAccount) {
            if (requirement.principal.comparePublicKey(context.ledger.initialTrustedAccount) && context.openingBlock) {
                const isBaseToken = context.ledger.baseToken.comparePublicKey(requirement.entity);
                const isNetworkAddress = context.ledger.networkAddress.comparePublicKey(requirement.entity);
                if (isBaseToken || isNetworkAddress) {
                    return;
                }
            }
        }
        state.touched.add(requirement.entity);
        if (requirement.target) {
            state.touched.add(requirement.target);
        }
        addPermissionRequirement(state, {
            entity: requirement.entity,
            principal: requirement.principal,
            permissions: requirement.permissions,
            target: requirement.target
        });
    }
}
export function computeEffectOfBlocks(blocks: Block[], ledger?: undefined): OnlyTouchedEffects;
export function computeEffectOfBlocks(blocks: Block[], ledger: LedgerOptions): ComputedEffectOfBlocks;
export function computeEffectOfBlocks(blocks: Block[], ledger?: LedgerOptions): ComputedEffectOfBlocks | OnlyTouchedEffects {
    const accumulatedEffects: ComputedEffectOfBlocks = {
        accounts: {},
        touched: new Account.Set(),
        possibleNewAccounts: new Account.Set(),
        metadata: {
            blockCount: 0,
            operationCount: 0,
            feeUnits: 0n
        }
    };
    let onlyReturnTouched = false;
    if (!ledger) {
        onlyReturnTouched = true;
        const initialTrustedAccount = Account.fromSeed(Account.generateRandomSeed(), 0);
        const { baseToken, networkAddress } = Account.generateBaseAddresses(0n);
        ledger = { initialTrustedAccount, baseToken, networkAddress };
    }
    const resolvedLedger: LedgerOptions = ledger;
    /**
     * Compute the effect of each block
     */
    for (const block of blocks) {
        accumulatedEffects.metadata.blockCount++;
        accumulatedEffects.metadata.feeUnits += baseBlockFeeUnit;
        const blockAccountPubKey = block.account.publicKeyString.get();
        const signerQueue: Array<typeof block.signer> = [block.signer];
        while (signerQueue.length > 0) {
            // We can assume that the signerFieldQueue is not empty here since the loop condition checks it
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const signer = signerQueue.shift()!;
            if (Account.isInstance(signer)) {
                accumulatedEffects.touched.add(signer);
                continue;
            }
            accumulatedEffects.touched.add(signer[0]);
            signerQueue.push(...signer[1]);
        }
        if (block.$opening) {
            accumulatedEffects.possibleNewAccounts.add(block.account);
            accumulatedEffects.metadata.feeUnits += openingBlockFeeUnit;
        }
        if (!(block.principal.comparePublicKey(block.account))) {
            accumulatedEffects.possibleNewAccounts.add(block.principal);
        }
        if (accumulatedEffects.accounts[blockAccountPubKey] === undefined) {
            accumulatedEffects.accounts[blockAccountPubKey] = {
                type: 'ACCOUNT',
                account: block.account,
                fields: {}
            };
        }
        /**
         * Compute the effect for each operation
         */
        for (const operationIndex in block.operations) {
            const context: EffectContext = {
                ledger: resolvedLedger,
                operationIndex: Number(operationIndex),
                signedByDifferent: !block.account.comparePublicKey(block.principal),
                openingBlock: block.$opening
            };
            const operation = block.operations[operationIndex];
            const handler = operationHandlers[operation.type] as OperationHandler;
            accumulatedEffects.metadata.operationCount++;
            accumulatedEffects.metadata.feeUnits += getOperationFeeUnit(operation.type);
            if (handler.accountPermissionACL) {
                computePermissionEffect(accumulatedEffects, 'ACCOUNT', handler.accountPermissionACL, block, operation, context);
            }
            if (context.signedByDifferent) {
                let permissionEffect: OperationHandler['signerPermissionACL'] = ['ADMIN'];
                if (handler.signerPermissionACL) {
                    permissionEffect = handler.signerPermissionACL;
                }
                computePermissionEffect(accumulatedEffects, 'SIGNER', permissionEffect, block, operation, context);
                if (Array.isArray(block.signer)) {
                    const signerFieldQueue = [block.signer];
                    while (signerFieldQueue.length > 0) {
                        // We can assume that the signerFieldQueue is not empty here since the loop condition checks it
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        const [multisig, signers] = signerFieldQueue.shift()!;
                        updateMinSignerSetLength(accumulatedEffects, multisig, BigInt(signers.length));
                        for (const signer of signers) {
                            let principal;
                            if (Account.isInstance(signer)) {
                                principal = signer;
                            }
                            else {
                                principal = signer[0];
                                signerFieldQueue.push(signer);
                            }
                            addPermissionRequirement(accumulatedEffects, {
                                entity: multisig,
                                principal: principal,
                                permissions: new Permissions(['MULTISIG_SIGNER'])
                            });
                        }
                    }
                }
            }
            handler.effectGenerator(accumulatedEffects, block, operation, context);
        }
    }
    for (const effect of Object.values(accumulatedEffects.accounts)) {
        if (effect.type !== 'ACCOUNT') {
            continue;
        }
        accumulatedEffects.touched.add(effect.account);
        if (effect.fields.balance) {
            let hasDebit = false;
            let hasCredit = false;
            let hasSet = false;
            for (const balanceChangeArray of Object.values(effect.fields.balance)) {
                for (const change of balanceChangeArray) {
                    if ('set' in change && change.set) {
                        hasSet = true;
                    }
                    else if (change.value < 0n) {
                        hasDebit = true;
                    }
                    else if (change.value >= 0n) {
                        hasCredit = true;
                    }
                }
            }
            if (hasSet || hasCredit) {
                if (!hasDebit) {
                    accumulatedEffects.possibleNewAccounts.add(effect.account);
                }
            }
        }
    }
    if (onlyReturnTouched) {
        return ({
            touched: accumulatedEffects.touched,
            possibleNewAccounts: accumulatedEffects.possibleNewAccounts
        });
    }
    return (accumulatedEffects);
}

/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
export const computeLedgerEffectCopied = async function(
    options: ComputeLedgerEffectOptions,
    effects: ComputedEffectOfBlocksByEntity,
    storageProvider: ComputeLedgerEffectStorage,
    network: bigint,
    transaction?: unknown
) {
    const { getFinalNumericValues = false, computePermissions = false, computeWeights = false, checkRangeConstraints = false, baseToken } = options;
    const getBalancePromises: { [account: string]: { [token: string]: Promise<bigint> } } = {};
    const getPreviousBalance = async (account: GenericAccount, token: TokenAddress) => {
        const accountPubKey = Account.toPublicKeyString(account);
        const tokenPubKey = Account.toPublicKeyString(token);
        if (!getBalancePromises[accountPubKey]) {
            getBalancePromises[accountPubKey] = {} as any;
        }
        if (getBalancePromises[accountPubKey][tokenPubKey] === undefined) {
            getBalancePromises[accountPubKey][tokenPubKey] = storageProvider.getBalance(transaction, account, token);
        }
        return (await getBalancePromises[accountPubKey][tokenPubKey]);
    };
    const getWeightPromises: { [rep: string]: Promise<bigint> } = {};
    const getWeight = async (rep: GenericAccount) => {
        const repPubKey = String(rep.publicKeyString);
        if (getWeightPromises[repPubKey] === undefined) {
            getWeightPromises[repPubKey] = storageProvider.delegatedWeight(transaction, rep as Account);
        }
        return (await getWeightPromises[repPubKey]);
    };
    const getRepPromises: { [account: string]: Promise<GenericAccount | null> } = {};
    const getRep = async (account: GenericAccount, readWeight?: boolean) => {
        const accountPubKey = Account.toPublicKeyString(account);
        if (getRepPromises[accountPubKey] === undefined) {
            getRepPromises[accountPubKey] = storageProvider.getAccountRep(transaction, account);
        }
        const resolvedRep = await getRepPromises[accountPubKey];
        if (resolvedRep && readWeight) {
            await getWeight(resolvedRep);
        }
        return (resolvedRep);
    };
    const getAccountInfoPromises: { [account: string]: ReturnType<ComputeLedgerEffectStorage['getAccountInfo']> } = {};
    const getAccountInfo = async (account: GenericAccount) => {
        const accountPubKey = Account.toPublicKeyString(account);
        if (getAccountInfoPromises[accountPubKey] === undefined) {
            getAccountInfoPromises[accountPubKey] = storageProvider.getAccountInfo(transaction, account);
        }
        // We know this is correct as we are accessing the object via the account's public key
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const resolved = await getAccountInfoPromises[accountPubKey];
        return (resolved);
    };
    const getCertificatePromises: { [key: string]: ReturnType<ComputeLedgerEffectStorage['getAccountCertificateByHash']> } = {};
    const getCertificate = async (certificateHash: CertificateHash, account: GenericAccount) => {
        const promiseKey = `${certificateHash.toString()}-${account.publicKeyString.get()}`;
        if (getCertificatePromises[promiseKey] === undefined) {
            getCertificatePromises[promiseKey] = storageProvider.getAccountCertificateByHash(transaction, account, certificateHash);
        }
        return (await getCertificatePromises[promiseKey]);
    };
    const getPermissionPromises: { [key: string]: ReturnType<ComputeLedgerEffectStorage['listACLsByPrincipal']> } = {};
    const getPermissions = async (principal: Parameters<ComputeLedgerEffectStorage['listACLsByPrincipal']>[1], entityList?: Parameters<ComputeLedgerEffectStorage['listACLsByPrincipal']>[2]) => {
        let promiseKey;
        if (Account.isInstance(principal)) {
            promiseKey = `account-${principal.publicKeyString.get()}`;
        }
        else {
            promiseKey = `certificate-${principal.certificate.toString()}-${principal.certificateAccount.publicKeyString.get()}`;
        }
        if (!entityList) {
            return (await getPermissionPromises[promiseKey]);
        }
        if (getPermissionPromises[promiseKey] !== undefined) {
            throw new Error('getPermissions() can only be called once per account');
        }
        getPermissionPromises[promiseKey] = storageProvider.listACLsByPrincipal(transaction, principal, entityList);
        return (await getPermissionPromises[promiseKey]);
    };
    const prefetchPromises = [];
    for (const effect of Object.values(effects)) {
        const fields = effect.fields;
        const toReadEntity = new Account.Set();
        for (const permUpdate of fields.permissions ?? []) {
            if ((permUpdate.method === Block.AdjustMethod.ADD || permUpdate.method === Block.AdjustMethod.SET) && permUpdate.principalType === 'CERTIFICATE') {
                prefetchPromises.push(getCertificate(permUpdate.principal.certificate, permUpdate.principal.certificateAccount));
            }
            if (permUpdate.method === Block.AdjustMethod.SET || permUpdate.permissions === null) {
                toReadEntity.delete(permUpdate.entity);
                continue;
            }
            toReadEntity.add(permUpdate.entity);
        }
        let principal: Parameters<ComputeLedgerEffectStorage['listACLsByPrincipal']>[1];
        if (effect.type === 'ACCOUNT') {
            principal = effect.account;
        }
        else {
            principal = {
                usingCertificate: true as const,
                certificate: effect.certificateHash,
                certificateAccount: effect.certificateAccount
            };
        }
        // Only prefetch the permissions if we are computing the permissions
        if (computePermissions) {
            prefetchPromises.push(getPermissions(principal, toReadEntity.toArray()));
        }
        if (effect.type !== 'CERTIFICATE') {
            const { account } = effect;
            // Always fetch the supply from accountInfo if it's changing so we can validate the effect
            if ((fields.supply ?? []).length > 0 && (checkRangeConstraints || getFinalNumericValues)) {
                prefetchPromises.push(getAccountInfo(account));
            }
            const accountPubKey = account.publicKeyString.get();
            const delegationField = effects[accountPubKey]?.fields.delegation;
            const isDelegating = delegationField !== undefined;
            let requestedRep = false;
            if (isDelegating && computeWeights && getFinalNumericValues && canDelegate(account.keyType)) {
                requestedRep = true;
                prefetchPromises.push(getRep(account, getFinalNumericValues));
                prefetchPromises.push(getWeight(delegationField.delegateTo));
            }
            const rollingChanges = {} as any;
            for (const tokenPubKey in fields.balance ?? {}) {
                for (const balanceUpdate of (fields.balance ?? {})[tokenPubKey]) {
                    if (balanceUpdate.isReceive) {
                        continue;
                    }
                    const { set, value } = balanceUpdate;
                    const token = Account.fromPublicKeyString(tokenPubKey).assertKeyType(AccountKeyAlgorithm.TOKEN);
                    if (rollingChanges[tokenPubKey] === undefined) {
                        rollingChanges[tokenPubKey] = 0n;
                    }
                    if (set) {
                        prefetchPromises.push(getPreviousBalance(token, token));
                        rollingChanges[tokenPubKey] = value;
                    }
                    else {
                        rollingChanges[tokenPubKey] += value;
                    }
                    const isBaseToken = baseToken.comparePublicKey(tokenPubKey);
                    const possibleNegative = rollingChanges[tokenPubKey] < 0n && checkRangeConstraints;
                    if ((possibleNegative && checkRangeConstraints) || set || getFinalNumericValues || (isDelegating && computeWeights)) {
                        prefetchPromises.push(getPreviousBalance(account, token));
                    }
                    if (computeWeights && isBaseToken && canDelegate(account.keyType) && !requestedRep) {
                        requestedRep = true;
                        prefetchPromises.push(getRep(account, getFinalNumericValues));
                    }
                }
            }
        }
        // Process promises in batches to avoid spanner's 100 concurrent read per session limit
        if (prefetchPromises.length > 50) {
            const toAwait = prefetchPromises.splice(0);
            await Promise.all(toAwait);
        }
    }
    // Wait for the final batch to complete
    await Promise.all(prefetchPromises);
    const supplies = {} as any;
    const balances = {} as any;
    const weights = {} as any;
    const permissions: ACLUpdate[] = [];
    const getBalanceEntry = (account: GenericAccount, token: TokenAddress) => {
        const accountPubKey = account.publicKeyString.get();
        const tokenPubKey = token.publicKeyString.get();
        if (!balances[accountPubKey]) {
            balances[accountPubKey] = {} as any;
        }
        let entry = balances[accountPubKey][tokenPubKey];
        if (!entry) {
            entry = balances[accountPubKey][tokenPubKey] = { change: 0n, lowestChange: 0n };
        }
        return (entry);
    };
    const modifyBalance = async (account: GenericAccount, token: TokenAddress, value: bigint, isSet: boolean) => {
        const accountPubKey = account.publicKeyString.get();
        const tokenPubKey = token.publicKeyString.get();
        const newEntry = getBalanceEntry(account, token);
        if (newEntry.starting === undefined) {
            if (getBalancePromises[accountPubKey] && getBalancePromises[accountPubKey][tokenPubKey] !== undefined) {
                const previous = await getPreviousBalance(account, token);
                newEntry.starting = previous;
                newEntry.final = previous;
            }
        }
        let newChange = value;
        if (isSet) {
            newEntry.starting = await getPreviousBalance(account, token);
            newChange = value - newEntry.starting;
            newEntry.final = value;
        }
        else {
            if (newEntry.final !== undefined) {
                newEntry.final += value;
            }
        }
        newEntry.change += newChange;
        if (newEntry.change < newEntry.lowestChange) {
            newEntry.lowestChange = newEntry.change;
        }
        if (newEntry.lowestChange < 0n && checkRangeConstraints) {
            if (newEntry.starting === undefined) {
                throw new Error('Starting balance should not be undefined here');
            }
        }
        if (newEntry.final && newEntry.final < 0n) {
            newEntry.fellNegative = true;
        }
        balances[accountPubKey][tokenPubKey] = newEntry;
        return (newChange);
    };
    const modifyWeight = async (rep: GenericAccount, change: bigint) => {
        const repPubKey = rep.publicKeyString.get();
        let newEntry = weights[repPubKey];
        if (newEntry === undefined) {
            newEntry = { change: 0n };
            if (getFinalNumericValues) {
                newEntry.final = await getWeight(rep);
            }
        }
        if (newEntry.final !== undefined) {
            newEntry.final += change;
        }
        newEntry.change += change;
        weights[repPubKey] = newEntry;
    };
    const modifySupply = async (token: TokenAddress, change: bigint) => {
        const tokenPubKey = token.publicKeyString.get();
        let newEntry = supplies[tokenPubKey];
        if (newEntry === undefined) {
            newEntry = { change: 0n };
            if (checkRangeConstraints || getFinalNumericValues) {
                const accountInfo = await getAccountInfo(token);
                newEntry.final = 'supply' in accountInfo ? accountInfo.supply : 0n;
            }
        }
        if (newEntry.final !== undefined) {
            newEntry.final += change;
            validateSupply(newEntry.final, network);
        }
        newEntry.change += change;
        supplies[tokenPubKey] = newEntry;
    };
    for (const effect of Object.values(effects)) {
        const fields = effect.fields;
        for (const supplyChange of fields.supply ?? []) {
            if (effect.type !== 'ACCOUNT' || !effect.account.isToken()) {
                throw new Error('Cannot modify supply of non-token account');
            }
            await modifySupply(effect.account, supplyChange.value);
        }
        for (const permUpdate of fields.permissions ?? []) {
            let principal: Parameters<ComputeLedgerEffectStorage['listACLsByPrincipal']>[1];
            if (effect.type === 'ACCOUNT') {
                principal = effect.account;
                if (!Account.isInstance(permUpdate.principal)) {
                    throw new Error('permUpdate.principal should be an account for ACCOUNT type effects');
                }
                if (!permUpdate.principal.comparePublicKey(effect.account)) {
                    throw new Error('permUpdate.principal should not differ current account');
                }
            }
            else {
                if (Account.isInstance(permUpdate.principal)) {
                    throw new Error('permUpdate.principal should be a certificate for CERTIFICATE type effects');
                }
                if (!permUpdate.principal.certificate.compareHexString(effect.certificateHash)) {
                    throw new Error('permUpdate.principal should not differ current certificate');
                }
                principal = {
                    usingCertificate: true as const,
                    certificate: effect.certificateHash,
                    certificateAccount: effect.certificateAccount
                };
                if (permUpdate.method === Block.AdjustMethod.ADD || permUpdate.method === Block.AdjustMethod.SET) {
                    const certificate = await getCertificate(permUpdate.principal.certificate, permUpdate.principal.certificateAccount);
                    if (!certificate) {
                        throw new KeetaNetLedgerError('LEDGER_CERTIFICATE_NOT_FOUND', `Certificate with hash ${permUpdate.principal.certificate.toString()} for account ${permUpdate.principal.certificateAccount.publicKeyString.get()} not found`);
                    }
                }
            }
            // If not computing permissions, we only need to validate certificate existence
            if (!computePermissions) {
                continue;
            }
            if (permUpdate.method === Block.AdjustMethod.SET || permUpdate.permissions === null) {
                permissions.push(permUpdate);
                continue;
            }
            let newPermissions;
            const previousEntry = findPermissionMatch(permUpdate, await getPermissions(principal));
            const previousPermissions = previousEntry?.permissions ?? new Permissions();
            switch (permUpdate.method) {
                case Block.AdjustMethod.ADD:
                    newPermissions = previousPermissions.combine(permUpdate.permissions);
                    break;
                case Block.AdjustMethod.SUBTRACT:
                    newPermissions = previousPermissions.remove(permUpdate.permissions);
                    break;
            }
            permissions.push({
                ...permUpdate,
                method: Block.AdjustMethod.SET,
                permissions: newPermissions
            });
        }
        let isDelegating;
        let delegationField;
        if (effect.type === 'ACCOUNT') {
            delegationField = effects[effect.account.publicKeyString.get()]?.fields.delegation;
            isDelegating = delegationField !== undefined;
            if (isDelegating && delegationField && canDelegate(effect.account.keyType) && computeWeights) {
                const currentDelegation = await getRep(effect.account, getFinalNumericValues);
                const previousBalance = await getPreviousBalance(effect.account, baseToken);
                await modifyWeight(delegationField.delegateTo, previousBalance);
                if (currentDelegation) {
                    await modifyWeight(currentDelegation, -1n * previousBalance);
                }
            }
        }
        const receivable = {} as any;
        for (const tokenPubKey in fields.balance ?? {}) {
            const tokenAcct = Account.fromPublicKeyString(tokenPubKey).assertKeyType(AccountKeyAlgorithm.TOKEN);
            for (const balanceUpdate of (fields.balance ?? {})[tokenPubKey]) {
                if (effect.type !== 'ACCOUNT') {
                    throw new Error('Only accounts can have balance changes');
                }
                const { isReceive, value, otherAccount } = balanceUpdate;
                if (isReceive) {
                    const receiveFromPubKey = otherAccount.publicKeyString.get();
                    const previousEntry = getBalanceEntry(effect.account, tokenAcct);
                    if (previousEntry.receiveValidated === false) {
                        continue;
                    }
                    let receivableAmount;
                    if (receivable[receiveFromPubKey]) {
                        receivableAmount = receivable[receiveFromPubKey][tokenPubKey];
                    }
                    if (!receivableAmount) {
                        receivableAmount = 0n;
                    }
                    let receiveValid = false;
                    if (balanceUpdate.exact) {
                        receiveValid = value === receivableAmount;
                    }
                    else {
                        receiveValid = value <= receivableAmount;
                    }
                    balances[effect.account.publicKeyString.get()][tokenPubKey].receiveValidated = receiveValid;
                    continue;
                }
                let balanceChange;
                if (balanceUpdate.set) {
                    balanceChange = await modifyBalance(effect.account, tokenAcct, value, true);
                    await modifyBalance(tokenAcct, tokenAcct, -1n * balanceChange, false);
                }
                else {
                    balanceChange = await modifyBalance(effect.account, tokenAcct, value, false);
                }
                if (balanceUpdate.receivable) {
                    const otherAccountPubKey = otherAccount.publicKeyString.get();
                    // Make sure this is an object and not undefined
                    receivable[otherAccountPubKey] = { ...receivable[otherAccountPubKey] };
                    if (!receivable[otherAccountPubKey][tokenPubKey]) {
                        receivable[otherAccountPubKey][tokenPubKey] = 0n;
                    }
                    receivable[otherAccountPubKey][tokenPubKey] += balanceChange;
                }
                const isBaseToken = baseToken.comparePublicKey(tokenAcct);
                if (isBaseToken && canDelegate(effect.account.keyType) && computeWeights) {
                    if (isDelegating) {
                        if (!delegationField) {
                            throw new Error('delegationField should be defined if isDelegating is true');
                        }
                        await modifyWeight(delegationField.delegateTo, balanceChange);
                    }
                    else {
                        const currentRep = await getRep(effect.account);
                        if (currentRep) {
                            await modifyWeight(currentRep, balanceChange);
                        }
                    }
                }
            }
        }
    }
    const ret: {
        balances: typeof balances;
        supplies: typeof supplies;
        weights?: typeof weights;
        permissions?: ACLUpdate[];
    } = { balances, supplies };
    // We only return weights if computeWeights is set to true
    if (computeWeights) {
        ret.weights = weights;
    }
    // We only return permissions if computePermissions is set to true
    if (computePermissions) {
        ret.permissions = permissions;
    }
    // We know this type is correct because we only set those values if they are defined
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ret;
};


type EffectsPublic = Omit<typeof import('./effects'), 'computeLedgerEffectCopied'>;
type _AssertMatchesClient = AssertNever<
	| (EffectsPublic extends typeof import('@keetanetwork/keetanet-client/lib/ledger/effects') ? never : EffectsPublic)
	| (typeof import('@keetanetwork/keetanet-client/lib/ledger/effects') extends EffectsPublic ? never : typeof import('@keetanetwork/keetanet-client/lib/ledger/effects'))
>;
