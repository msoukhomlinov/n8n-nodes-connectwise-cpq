import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, buildConditionsFromUi, prepareJsonPatch } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const quotesOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quotes'] } },
    options: [
      {
        name: 'Copy',
        value: 'copy',
        description: 'Copy a quote or template by ID. Also copies tabs, items, and quote customers.',
        action: 'Copy a quote',
      },
      {
        name: 'Delete',
        value: 'delete',
        description: 'Delete a quote by ID',
        action: 'Delete a quote',
      },
      {
        name: 'Delete Version',
        value: 'deleteVersion',
        description: 'Delete a specific version of a quote by quote number and version',
        action: 'Delete a quote version',
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Get a quote by ID',
        action: 'Get a quote',
      },
      {
        name: 'Get Latest Version',
        value: 'getLatestVersion',
        description: 'Get the latest version of a quote by quote number',
        action: 'Get latest quote version',
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Retrieve a list of quotes',
        action: 'Get many quotes',
      },
      {
        name: 'Get Version',
        value: 'getVersion',
        description: 'Get a specific version of a quote by quote number and version',
        action: 'Get a quote version',
      },
      {
        name: 'Get Versions',
        value: 'getVersions',
        description: 'Get all versions of a quote by quote number',
        action: 'Get all quote versions',
      },
      {
        name: 'Update',
        value: 'update',
        description: 'Update a quote using JSON Patch operations',
        action: 'Update a quote',
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
    description: 'The ID of the quote',
    displayOptions: { show: { resource: ['quotes'], operation: ['get', 'delete', 'copy', 'update'] } },
  },
  {
    displayName: 'Quote Number',
    name: 'quoteNumber',
    type: 'number',
    required: true,
    default: 0,
    description: 'The quote number (integer, not the quote ID)',
    displayOptions: { show: { resource: ['quotes'], operation: ['getVersions', 'getLatestVersion', 'getVersion', 'deleteVersion'] } },
  },
  {
    displayName: 'Quote Version',
    name: 'quoteVersion',
    type: 'number',
    required: true,
    default: 0,
    description: 'The version number of the quote',
    displayOptions: { show: { resource: ['quotes'], operation: ['getVersion', 'deleteVersion'] } },
  },
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'JSON Patch array, e.g. [{"op":"replace","path":"/name","value":"New Name"}]',
    displayOptions: { show: { resource: ['quotes'], operation: ['update'] } },
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
    if (showAllVersions) qs.showAllVersions = showAllVersions;

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

  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const patchOperations = this.getNodeParameter('patchOperations', i) as string;
    let opsRaw: Array<{ op: string; path: string; value?: unknown; from?: string }>;
    try {
      opsRaw = patchOperations ? JSON.parse(patchOperations) : [];
    } catch {
      throw new NodeOperationError(
        this.getNode(),
        'Patch Operations is not valid JSON. Ensure the value is a JSON array.',
        { itemIndex: i },
      );
    }
    if (opsRaw.length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'Patch Operations must not be empty for the Update operation.',
        { itemIndex: i },
      );
    }
    const patchBody = prepareJsonPatch(opsRaw);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }

  if (operation === 'getVersions') {
    const quoteNumber = this.getNodeParameter('quoteNumber', i) as number;
    const res = (await cpqApiRequest.call(this, 'GET', `/api/quotes/${quoteNumber}/versions`)) as IDataObject[];
    const versions = Array.isArray(res) ? res : [];
    for (const entry of versions) returnData.push({ json: entry });
  }

  if (operation === 'getLatestVersion') {
    const quoteNumber = this.getNodeParameter('quoteNumber', i) as number;
    const res = (await cpqApiRequest.call(this, 'GET', `/api/quotes/${quoteNumber}/versions/latest`)) as IDataObject;
    returnData.push({ json: res });
  }

  if (operation === 'getVersion') {
    const quoteNumber = this.getNodeParameter('quoteNumber', i) as number;
    const quoteVersion = this.getNodeParameter('quoteVersion', i) as number;
    const res = (await cpqApiRequest.call(this, 'GET', `/api/quotes/${quoteNumber}/versions/${quoteVersion}`)) as IDataObject;
    returnData.push({ json: res });
  }

  if (operation === 'deleteVersion') {
    const quoteNumber = this.getNodeParameter('quoteNumber', i) as number;
    const quoteVersion = this.getNodeParameter('quoteVersion', i) as number;
    await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${quoteNumber}/versions/${quoteVersion}`);
    returnData.push({ json: { quoteNumber, quoteVersion, success: true } });
  }
}
