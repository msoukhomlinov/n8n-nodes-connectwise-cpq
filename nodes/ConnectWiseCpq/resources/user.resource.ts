import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildConditionsFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const userOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['user'] } },
    options: [
      { name: 'Get Many', value: 'getAll', description: 'List users', action: 'Get many users' },
      { name: 'Update', value: 'update', description: 'Update user (PATCH)', action: 'Update a user' },
    ],
    default: 'getAll',
  },
];

export const userFields: INodeProperties[] = [
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['user'], operation: ['update'] } },
  },
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    displayOptions: { show: { resource: ['user'], operation: ['update'] } },
  },
];

export async function executeUser(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const rawConditions = this.getNodeParameter('conditions', i, '') as string;
    const conditionsUi = this.getNodeParameter('conditionsUi', i, {}) as {
      conditions?: Array<{ field?: string; referenceSubfield?: string; operator?: string; valueType?: string; value?: string; values?: string }>;
    };
    const conditionsLogic = this.getNodeParameter('conditionsLogic', i, 'and') as 'and' | 'or';
    const conditions = buildConditionsFromUi(rawConditions, conditionsUi, conditionsLogic);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
    const limit = this.getNodeParameter('limit', i, 100) as number;
    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;
    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/settings/user',
        {},
        qs as IDataObject,
        {},
        undefined,
        MAX_PAGE_SIZE,
      )) as unknown[];
      for (const entry of all as IDataObject[]) returnData.push({ json: entry });
    } else {
      const effectivePageSize = Math.min(typeof limit === 'number' ? limit : pageSize, MAX_PAGE_SIZE);
      const some = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/settings/user',
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'update') {
    const userId = this.getNodeParameter('userId', i) as string;
    const patchOperations = this.getNodeParameter('patchOperations', i) as string;
    const opsRaw = (patchOperations ? JSON.parse(patchOperations) : []) as {
      op: string;
      path: string;
      value?: unknown;
      from?: string;
    }[];
    const patchBody = prepareJsonPatch(opsRaw);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/settings/user/${encodeURIComponent(userId)}`, patchBody)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }
}


