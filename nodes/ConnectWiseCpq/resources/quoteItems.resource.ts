import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildConditionsFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const quoteItemsOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quoteItems'] } },
    options: [
      { name: 'Create', value: 'create', description: 'Create quote item', action: 'Create a quote item' },
      { name: 'Delete', value: 'delete', description: 'Delete quote item', action: 'Delete a quote item' },
      { name: 'Get', value: 'get', description: 'Get quote item by ID', action: 'Get a quote item' },
      { name: 'Get Many', value: 'getAll', description: 'List quote items', action: 'Get many quote items' },
      { name: 'Update', value: 'update', description: 'Update quote item (PATCH)', action: 'Update a quote item' },
    ],
    default: 'getAll',
  },
];

export const quoteItemsFields: INodeProperties[] = [
  {
    displayName: 'Item ID',
    name: 'id',
    type: 'string',
    required: true,
    default: '',
    description: 'Quote item ID',
    displayOptions: { show: { resource: ['quoteItems'], operation: ['delete', 'update', 'get'] } },
  },
  {
    displayName: 'Item (JSON)',
    name: 'bodyJson',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'Raw JSON for QuoteItemView (POST body)',
    displayOptions: { show: { resource: ['quoteItems'], operation: ['create'] } },
  },
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'JSON Patch array, e.g. [{"op":"replace","path":"/quantity","value":2}]',
    displayOptions: { show: { resource: ['quoteItems'], operation: ['update'] } },
  },
];

export async function executeQuoteItems(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
    const limit = this.getNodeParameter('limit', i, 100) as number;
    const rawConditions = this.getNodeParameter('conditions', i, '') as string;
    const conditionsUi = this.getNodeParameter('conditionsUi', i, {}) as {
      conditions?: Array<{ field?: string; referenceSubfield?: string; operator?: string; valueType?: string; value?: string; values?: string }>;
    };
    const conditionsLogic = this.getNodeParameter('conditionsLogic', i, 'and') as 'and' | 'or';
    const conditions = buildConditionsFromUi(rawConditions, conditionsUi, conditionsLogic);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const showAllVersions = this.getNodeParameter('showAllVersions', i, false) as boolean;

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;
    if (typeof showAllVersions === 'boolean') qs.showAllVersions = showAllVersions;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/api/quoteItems',
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
        '/api/quoteItems',
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'create') {
    const bodyJson = this.getNodeParameter('bodyJson', i) as string;
    let body: IDataObject | IDataObject[] = {};
    if (bodyJson) {
      body = JSON.parse(bodyJson) as IDataObject;
    }
    const res = (await cpqApiRequest.call(this, 'POST', `/api/quoteItems`, body)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }

  if (operation === 'delete') {
    const id = this.getNodeParameter('id', i) as string;
    await cpqApiRequest.call(this, 'DELETE', `/api/quoteItems/${encodeURIComponent(id)}`);
    returnData.push({ json: { id, success: true } });
  }

  if (operation === 'update') {
    const id = this.getNodeParameter('id', i) as string;
    const patchOperations = this.getNodeParameter('patchOperations', i) as string;
    const opsRaw = (patchOperations ? JSON.parse(patchOperations) : []) as {
      op: string;
      path: string;
      value?: unknown;
      from?: string;
    }[];
    const patchBody = prepareJsonPatch(opsRaw);
    const res = (await cpqApiRequest.call(
      this,
      'PATCH',
      `/api/quoteItems/${encodeURIComponent(id)}`,
      patchBody,
    )) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }

  if (operation === 'get') {
    const id = this.getNodeParameter('id', i) as string;
    const res = (await cpqApiRequest.call(this, 'GET', `/api/quoteItems/${encodeURIComponent(id)}`)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }
}


