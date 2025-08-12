import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { cpqApiRequest } from '../GenericFunctions';

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
    const res = (await cpqApiRequest.call(this, 'GET', '/api/templates')) as unknown;
    const arr = Array.isArray(res) ? (res as IDataObject[]) : [res as IDataObject];
    for (const entry of arr) returnData.push({ json: entry as IDataObject });
  }
}


