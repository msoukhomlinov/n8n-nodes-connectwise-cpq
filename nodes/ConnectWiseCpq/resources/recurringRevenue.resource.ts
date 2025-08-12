import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { cpqApiRequestAllItems, buildConditionsFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const recurringRevenueOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['recurringRevenue'] } },
    options: [{ name: 'Get Many', value: 'getAll', description: 'List recurring revenues', action: 'Get many recurring revenues' }],
    default: 'getAll',
  },
];

export const recurringRevenueFields: INodeProperties[] = [];

export async function executeRecurringRevenue(
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

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/api/recurringRevenues',
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
        '/api/recurringRevenues',
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }
}


