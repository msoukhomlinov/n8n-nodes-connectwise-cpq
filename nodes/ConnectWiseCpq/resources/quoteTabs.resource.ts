import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { cpqApiRequestAllItems, buildFiltersFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const quoteTabsOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quoteTabs'] } },
    options: [
      { name: 'Get Many', value: 'getAll', description: 'List quote tabs', action: 'Get many quote tabs' },
      { name: 'Get Items By Tab', value: 'getItems', description: 'Get items by tab ID', action: 'Get items by tab' },
    ],
    default: 'getAll',
  },
];

export const quoteTabsFields: INodeProperties[] = [
  {
    displayName: 'Tab ID',
    name: 'id',
    type: 'string',
    required: true,
    default: '',
    description: 'Quote Tab ID',
    displayOptions: { show: { resource: ['quoteTabs'], operation: ['getItems'] } },
  },
];

export async function executeQuoteTabs(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
    const limit = this.getNodeParameter('limit', i, 100) as number;
    const filters = this.getNodeParameter('filters', i, {}) as {
      conditions?: Array<{ field?: string; operator?: string; valueType?: string; value?: string }>;
    };
    const filterLogic = this.getNodeParameter('filterLogic', i, 'and') as 'and' | 'or';
    const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as { rawConditions?: string };
    const conditions = buildFiltersFromUi(filters, filterLogic, additionalOptions.rawConditions);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const showAllVersions = this.getNodeParameter('showAllVersions', i, false) as boolean;

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;
    if (showAllVersions) qs.showAllVersions = showAllVersions;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/api/quoteTabs',
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
        '/api/quoteTabs',
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'getItems') {
    const id = this.getNodeParameter('id', i) as string;
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const limit = this.getNodeParameter('limit', i, 50) as number;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        `/api/quoteTabs/${encodeURIComponent(id)}/quoteItems`,
        {},
        {},
        {},
        undefined,
        MAX_PAGE_SIZE,
      )) as unknown[];
      for (const entry of all as IDataObject[]) returnData.push({ json: entry });
    } else {
      const effectivePageSize = Math.min(limit, MAX_PAGE_SIZE);
      const some = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        `/api/quoteTabs/${encodeURIComponent(id)}/quoteItems`,
        {},
        {},
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }
}


