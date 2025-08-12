import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, buildConditionsFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const quotesOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quotes'] } },
    options: [
      { name: 'Get', value: 'get', description: 'Get a quote by ID', action: 'Get a quote' },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'List quotes',
        action: 'Get many quotes',
      },
      {
        name: 'Delete',
        value: 'delete',
        description: 'Delete a quote by ID',
        action: 'Delete a quote',
      },
      {
        name: 'Copy',
        value: 'copy',
        description: 'Copy a quote/template by ID',
        action: 'Copy a quote',
      },
    ],
    default: 'getAll',
  },
];

export const quotesFields: INodeProperties[] = [
  {
    displayName: 'Quote ID',
    name: 'quoteId',
    type: 'string',
    required: true,
    default: '',
    description: 'The ID of the quote to retrieve',
    displayOptions: { show: { resource: ['quotes'], operation: ['get', 'delete', 'copy'] } },
  },
];

export async function executeQuotes(
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
        '/api/quotes',
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
        '/api/quotes',
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'get') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const res = (await cpqApiRequest.call(this, 'GET', `/api/quotes/${encodeURIComponent(quoteId)}`)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }

  if (operation === 'delete') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}`);
    returnData.push({ json: { id: quoteId, success: true } });
  }

  if (operation === 'copy') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const res = (await cpqApiRequest.call(
      this,
      'POST',
      `/api/quotes/copyById/${encodeURIComponent(quoteId)}`,
    )) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }
}


