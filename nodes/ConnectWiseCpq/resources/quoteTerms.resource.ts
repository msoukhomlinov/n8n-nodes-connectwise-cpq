import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildConditionsFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const quoteTermsOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quoteTerms'] } },
    options: [
      { name: 'Get Many', value: 'getAll', description: 'List quote terms', action: 'Get many quote terms' },
      { name: 'Create', value: 'create', description: 'Create quote term', action: 'Create a quote term' },
      { name: 'Delete', value: 'delete', description: 'Delete quote term', action: 'Delete a quote term' },
      { name: 'Update', value: 'update', description: 'Update quote term (PATCH)', action: 'Update a quote term' },
    ],
    default: 'getAll',
  },
];

export const quoteTermsFields: INodeProperties[] = [
  {
    displayName: 'Quote ID',
    name: 'quoteId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['quoteTerms'], operation: ['getAll', 'create', 'delete', 'update'] } },
  },
  {
    displayName: 'Term ID',
    name: 'id',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['quoteTerms'], operation: ['delete', 'update'] } },
  },
  {
    displayName: 'Term (JSON)',
    name: 'termJson',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'Raw JSON for QuoteTermView (POST body)',
    displayOptions: { show: { resource: ['quoteTerms'], operation: ['create'] } },
  },
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    displayOptions: { show: { resource: ['quoteTerms'], operation: ['update'] } },
  },
];

export async function executeQuoteTerms(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const rawConditions = this.getNodeParameter('conditions', i, '') as string;
    const conditionsUi = this.getNodeParameter('conditionsUi', i, {}) as {
      conditions?: Array<{ field?: string; referenceSubfield?: string; operator?: string; valueType?: string; value?: string; values?: string }>;
    };
    const conditionsLogic = this.getNodeParameter('conditionsLogic', i, 'and') as 'and' | 'or';
    const conditions = buildConditionsFromUi(rawConditions, conditionsUi, conditionsLogic);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const limit = this.getNodeParameter('limit', i, 100) as number;

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
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
        `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
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
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const termJson = this.getNodeParameter('termJson', i) as string;
    const body = termJson ? (JSON.parse(termJson) as IDataObject) : {};
    const res = (await cpqApiRequest.call(this, 'POST', `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`, body)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }

  if (operation === 'delete') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`);
    returnData.push({ json: { id, success: true } });
  }

  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    const patchOperations = this.getNodeParameter('patchOperations', i) as string;
    const opsRaw = (patchOperations ? JSON.parse(patchOperations) : []) as {
      op: string;
      path: string;
      value?: unknown;
      from?: string;
    }[];
    const patchBody = prepareJsonPatch(opsRaw);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`, patchBody)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }
}


