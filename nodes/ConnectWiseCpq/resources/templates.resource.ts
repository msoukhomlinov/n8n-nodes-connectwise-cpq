import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { cpqApiRequestAllItems, buildFiltersFromUi } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const templatesOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['templates'] } },
    options: [{ name: 'Get Many', value: 'getAll', description: 'List templates', action: 'Get many templates' }],
    default: 'getAll',
  },
];

export const templatesFields: INodeProperties[] = [];

export async function executeTemplates(
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

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/api/templates',
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
        '/api/templates',
        {},
        qs,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }
}


