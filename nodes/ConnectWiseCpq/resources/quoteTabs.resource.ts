import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, buildConditionsFromUi } from '../GenericFunctions';
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
    const rawConditions = this.getNodeParameter('conditions', i, '') as string;
    const conditionsUi = this.getNodeParameter('conditionsUi', i, {}) as {
      conditions?: Array<{ field?: string; referenceSubfield?: string; operator?: string; valueType?: string; value?: string; values?: string }>;
    };
    const conditionsLogic = this.getNodeParameter('conditionsLogic', i, 'and') as 'and' | 'or';
    const conditions = buildConditionsFromUi(rawConditions, conditionsUi, conditionsLogic);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const showAllVersions = this.getNodeParameter('showAllVersions', i, true) as boolean;

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;
    if (typeof showAllVersions === 'boolean') qs.showAllVersions = showAllVersions;

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
    const res = await cpqApiRequest.call(this, 'GET', `/api/quoteTabs/${encodeURIComponent(id)}/quoteItems`);
    const arr = Array.isArray(res) ? res : [res];
    for (const entry of arr) returnData.push({ json: entry });
  }
}


