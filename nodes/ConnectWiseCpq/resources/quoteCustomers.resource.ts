import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildConditionsFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const quoteCustomersOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quoteCustomers'] } },
    options: [
      { name: 'Delete', value: 'delete', description: 'Delete quote customer', action: 'Delete a quote customer' },
      { name: 'Get Many', value: 'getAll', description: 'List quote customers for a quote', action: 'Get many quote customers' },
      { name: 'Update', value: 'update', description: 'Update quote customer (PATCH)', action: 'Update a quote customer' },
      { name: 'Replace', value: 'replace', description: 'Replace quote customer (PUT)', action: 'Replace a quote customer' },
    ],
    default: 'getAll',
  },
];

export const quoteCustomersFields: INodeProperties[] = [
  {
    displayName: 'Quote ID',
    name: 'quoteId',
    type: 'string',
    required: true,
    default: '',
    description: 'The ID of the quote',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['getAll', 'update', 'delete', 'replace'] } },
  },
  {
    displayName: 'Customer ID',
    name: 'id',
    type: 'string',
    required: true,
    default: '',
    description: 'Quote customer ID',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['update', 'delete', 'replace'] } },
  },
  {
    displayName: 'Customer (JSON)',
    name: 'customerJson',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'Raw JSON for CustomerView (PUT body)',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['replace'] } },
  },
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'JSON Patch array, e.g. [{"op":"replace","path":"/email","value":"new@domain"}]',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['update'] } },
  },
];

export async function executeQuoteCustomers(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
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

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        `/api/quotes/${encodeURIComponent(quoteId)}/customers`,
        {},
        qs,
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
        `/api/quotes/${encodeURIComponent(quoteId)}/customers`,
        {},
        qs,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'delete') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`);
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
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`, patchBody)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }

  if (operation === 'replace') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    const customerJson = this.getNodeParameter('customerJson', i) as string;
    const body = customerJson ? (JSON.parse(customerJson) as IDataObject) : {};
    const res = (await cpqApiRequest.call(this, 'PUT', `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`, body)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }
}


