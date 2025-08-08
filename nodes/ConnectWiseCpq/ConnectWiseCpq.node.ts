import type {
  IExecuteFunctions,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
  IDataObject,
  INodeExecutionData,
} from 'n8n-workflow';

import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch } from './GenericFunctions';

/**
 * ConnectWise CPQ (Sell) n8n node.
 *
 * Exposes resources and operations to interact with the ConnectWise Sell REST API.
 */
export class ConnectWiseCpq implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ConnectWise CPQ (Sell)',
    name: 'connectWiseCpq',
    icon: 'file:connectwisecpq.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with ConnectWise CPQ (Sell) API',
    defaults: {
      name: 'ConnectWise CPQ',
    },
    inputs: ['main'] as NodeConnectionType[],
    outputs: ['main'] as NodeConnectionType[],
    credentials: [
      {
        name: 'connectWiseCpqApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Quote', value: 'quotes' },
          { name: 'Quote Customer', value: 'quoteCustomers' },
          { name: 'Quote Item', value: 'quoteItems' },
          { name: 'Quote Tab', value: 'quoteTabs' },
          { name: 'Quote Term', value: 'quoteTerms' },
          { name: 'Recurring Revenue', value: 'recurringRevenue' },
          { name: 'Tax Code', value: 'taxCodes' },
          { name: 'Template', value: 'templates' },
          { name: 'User', value: 'user' },
        ],
        default: 'quotes',
      },

      // Operations
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
      {
        displayName: 'Quote ID',
        name: 'quoteId',
        type: 'string',
        required: true,
        default: '',
        description: 'The ID of the quote to retrieve',
        displayOptions: { show: { resource: ['quotes'], operation: ['get', 'delete', 'copy'] } },
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['quoteItems'] } },
        options: [
          {
            name: 'Create',
            value: 'create',
            description: 'Create quote item',
            action: 'Create a quote item',
          },
          {
            name: 'Delete',
            value: 'delete',
            description: 'Delete quote item',
            action: 'Delete a quote item',
          },
          {
            name: 'Get',
            value: 'get',
            description: 'Get quote item by ID',
            action: 'Get a quote item',
          },
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List quote items',
            action: 'Get many quote items',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Update quote item (PATCH)',
            action: 'Update a quote item',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Item ID',
        name: 'id',
        type: 'string',
        required: true,
        default: '',
        description: 'Quote item ID',
        displayOptions: {
          show: { resource: ['quoteItems'], operation: ['delete', 'update', 'get'] },
        },
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
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['quoteCustomers'] } },
        options: [
          {
            name: 'Delete',
            value: 'delete',
            description: 'Delete quote customer',
            action: 'Delete a quote customer',
          },
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List quote customers for a quote',
            action: 'Get many quote customers',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Update quote customer (PATCH)',
            action: 'Update a quote customer',
          },
          {
            name: 'Replace',
            value: 'replace',
            description: 'Replace quote customer (PUT)',
            action: 'Replace a quote customer',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Quote ID',
        name: 'quoteId',
        type: 'string',
        required: true,
        default: '',

        displayOptions: {
          show: { resource: ['quoteCustomers'], operation: ['getAll', 'update', 'delete'] },
        },
      },
      // Quote Tabs
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['quoteTabs'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List quote tabs',
            action: 'Get many quote tabs',
          },
          {
            name: 'Get Items By Tab',
            value: 'getItems',
            description: 'Get items by tab ID',
            action: 'Get items by tab',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Tab ID',
        name: 'id',
        type: 'string',
        required: true,
        default: '',
        description: 'Quote Tab ID',
        displayOptions: { show: { resource: ['quoteTabs'], operation: ['getItems'] } },
      },
      // Quote Terms
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['quoteTerms'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List quote terms',
            action: 'Get many quote terms',
          },
          {
            name: 'Create',
            value: 'create',
            description: 'Create quote term',
            action: 'Create a quote term',
          },
          {
            name: 'Delete',
            value: 'delete',
            description: 'Delete quote term',
            action: 'Delete a quote term',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Update quote term (PATCH)',
            action: 'Update a quote term',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Quote ID',
        name: 'quoteId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['quoteTerms'], operation: ['getAll', 'create', 'delete', 'update'] },
        },
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
      // Recurring Revenue
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['recurringRevenue'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List recurring revenues',
            action: 'Get many recurring revenues',
          },
        ],
        default: 'getAll',
      },
      // Tax Codes
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['taxCodes'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List tax codes',
            action: 'Get many tax codes',
          },
        ],
        default: 'getAll',
      },
      // Templates
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['templates'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List templates',
            action: 'Get many templates',
          },
        ],
        default: 'getAll',
      },
      // User
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['user'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getAll',
            description: 'List users',
            action: 'Get many users',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Update user (PATCH)',
            action: 'Update a user',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: { show: { resource: ['user'], operation: ['update'] } },
      },
      {
        displayName: 'Patch Operations (JSON)',
        name: 'patchOperations',
        type: 'string',
        typeOptions: { rows: 6 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['user'], operation: ['update'] } },
      },
      {
        displayName: 'Customer ID',
        name: 'id',
        type: 'string',
        required: true,
        default: '',
        description: 'Quote customer ID',
        displayOptions: {
          show: { resource: ['quoteCustomers'], operation: ['update', 'delete', 'replace'] },
        },
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
        description:
          'JSON Patch array, e.g. [{"op":"replace","path":"/email","value":"new@domain"}]',
        displayOptions: { show: { resource: ['quoteCustomers'], operation: ['update'] } },
      },

      // Common optional parameters (scaffold only)
      {
        displayName: 'Conditions',
        name: 'conditions',
        type: 'string',
        default: '',
        description: 'Conditional retrieve statements',
      },
      {
        displayName: 'Include Fields',
        name: 'includeFields',
        type: 'string',
        default: '',
        description: 'Comma-separated list of fields to return',
      },
      {
        displayName: 'Show All Versions',
        name: 'showAllVersions',
        type: 'boolean',
        default: false,
        description: 'Include deleted or archived quotes in results where supported',
      },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: {
          minValue: 1,
        },
        description: 'Max number of results to return',
        default: 50,
        displayOptions: { show: { returnAll: [false] } },
      },
      {
        displayName: 'Page Size',
        name: 'pageSize',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 1000 },
        default: 50,
        description: 'Max 1000',
      },
    ],
  };

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const returnData: unknown[] = [];
    const length = items.length;
    const resource = this.getNodeParameter('resource', 0);
    const operation = this.getNodeParameter('operation', 0) as string;
    const continueOnFail = this.continueOnFail();

    for (let i = 0; i < length; i++) {
      try {
        if (resource === 'quotes') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const limit = this.getNodeParameter('limit', i, 100) as number;
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;
            const showAllVersions = this.getNodeParameter('showAllVersions', i, false) as boolean;

            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;
            if (typeof showAllVersions === 'boolean') qs.showAllVersions = showAllVersions;

            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                '/api/quotes',
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                '/api/quotes',
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }

          if (operation === 'get') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const res = await cpqApiRequest.call(
              this,
              'GET',
              `/api/quotes/${encodeURIComponent(quoteId)}`,
            );
            returnData.push({ json: res });
          }

          if (operation === 'delete') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}`);
            returnData.push({ json: { id: quoteId, success: true } });
          }

          if (operation === 'copy') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const res = await cpqApiRequest.call(
              this,
              'POST',
              `/api/quotes/copyById/${encodeURIComponent(quoteId)}`,
            );
            returnData.push({ json: res });
          }
        }

        if (resource === 'quoteItems') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const limit = this.getNodeParameter('limit', i, 100) as number;
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;
            const showAllVersions = this.getNodeParameter('showAllVersions', i, false) as boolean;

            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;
            if (typeof showAllVersions === 'boolean') qs.showAllVersions = showAllVersions;

            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                '/api/quoteItems',
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                '/api/quoteItems',
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }

          if (operation === 'create') {
            const bodyJson = this.getNodeParameter('bodyJson', i) as string;
            let body: IDataObject | IDataObject[] = {};
            if (bodyJson) {
              body = JSON.parse(bodyJson) as IDataObject;
            }
            const res = await cpqApiRequest.call(this, 'POST', `/api/quoteItems`, body);
            returnData.push({ json: res });
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
            const res = await cpqApiRequest.call(
              this,
              'PATCH',
              `/api/quoteItems/${encodeURIComponent(id)}`,
              patchBody,
            );
            returnData.push({ json: res });
          }

          if (operation === 'get') {
            const id = this.getNodeParameter('id', i) as string;
            const res = await cpqApiRequest.call(
              this,
              'GET',
              `/api/quoteItems/${encodeURIComponent(id)}`,
            );
            returnData.push({ json: res });
          }
        }

        if (resource === 'quoteCustomers') {
          if (operation === 'getAll') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const res = await cpqApiRequest.call(
              this,
              'GET',
              `/api/quotes/${encodeURIComponent(quoteId)}/customers`,
            );
            const arr = Array.isArray(res) ? res : [res];
            for (const entry of arr) returnData.push({ json: entry });
          }

          if (operation === 'delete') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const id = this.getNodeParameter('id', i) as string;
            await cpqApiRequest.call(
              this,
              'DELETE',
              `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`,
            );
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
            const res = await cpqApiRequest.call(
              this,
              'PATCH',
              `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`,
              patchBody,
            );
            returnData.push({ json: res });
          }

          if (operation === 'replace') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const id = this.getNodeParameter('id', i) as string;
            const customerJson = this.getNodeParameter('customerJson', i) as string;
            const body = customerJson ? (JSON.parse(customerJson) as IDataObject) : {};
            const res = await cpqApiRequest.call(
              this,
              'PUT',
              `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`,
              body,
            );
            returnData.push({ json: res });
          }
        }

        if (resource === 'quoteTabs') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const limit = this.getNodeParameter('limit', i, 100) as number;
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;
            const showAllVersions = this.getNodeParameter('showAllVersions', i, true) as boolean;

            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;
            if (typeof showAllVersions === 'boolean') qs.showAllVersions = showAllVersions;

            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                '/api/quoteTabs',
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                '/api/quoteTabs',
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }

          if (operation === 'getItems') {
            const id = this.getNodeParameter('id', i) as string;
            const res = await cpqApiRequest.call(
              this,
              'GET',
              `/api/quoteTabs/${encodeURIComponent(id)}/quoteItems`,
            );
            const arr = Array.isArray(res) ? res : [res];
            for (const entry of arr) returnData.push({ json: entry });
          }
        }

        if (resource === 'quoteTerms') {
          if (operation === 'getAll') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const limit = this.getNodeParameter('limit', i, 100) as number;

            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;

            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }

          if (operation === 'create') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const termJson = this.getNodeParameter('termJson', i) as string;
            const body = termJson ? (JSON.parse(termJson) as IDataObject) : {};
            const res = await cpqApiRequest.call(
              this,
              'POST',
              `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
              body,
            );
            returnData.push({ json: res });
          }

          if (operation === 'delete') {
            const quoteId = this.getNodeParameter('quoteId', i) as string;
            const id = this.getNodeParameter('id', i) as string;
            await cpqApiRequest.call(
              this,
              'DELETE',
              `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`,
            );
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
            const res = await cpqApiRequest.call(
              this,
              'PATCH',
              `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`,
              patchBody,
            );
            returnData.push({ json: res });
          }
        }

        if (resource === 'recurringRevenue') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const limit = this.getNodeParameter('limit', i, 100) as number;
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;

            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;

            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                '/api/recurringRevenues',
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                '/api/recurringRevenues',
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }
        }

        if (resource === 'taxCodes') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const limit = this.getNodeParameter('limit', i, 100) as number;
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;

            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;

            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                '/api/taxCodes',
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                '/api/taxCodes',
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }
        }

        if (resource === 'templates') {
          if (operation === 'getAll') {
            // No filters noted beyond default
            const res = await cpqApiRequest.call(this, 'GET', '/api/templates');
            const arr = Array.isArray(res) ? res : [res];
            for (const entry of arr) returnData.push({ json: entry });
          }
        }

        if (resource === 'user') {
          if (operation === 'getAll') {
            const conditions = this.getNodeParameter('conditions', i, '') as string;
            const includeFields = this.getNodeParameter('includeFields', i, '') as string;
            const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
            const limit = this.getNodeParameter('limit', i, 100) as number;
            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (includeFields) qs.includeFields = includeFields;
            if (returnAll) {
              const all = await cpqApiRequestAllItems.call(
                this,
                '',
                'GET',
                '/settings/user',
                {},
                qs as IDataObject,
                {},
                undefined,
                pageSize,
              );
              for (const entry of all) returnData.push({ json: entry });
            } else {
              const effectivePageSize = Math.min(pageSize, limit);
              const res = await cpqApiRequest.call(
                this,
                'GET',
                '/settings/user',
                {},
                { ...(qs as IDataObject), page: 1, pageSize: effectivePageSize },
              );
              const arr = Array.isArray(res) ? res : [];
              for (const entry of arr.slice(0, limit)) returnData.push({ json: entry });
            }
          }
          if (operation === 'update') {
            const userId = this.getNodeParameter('userId', i) as string;
            const patchOperations = this.getNodeParameter('patchOperations', i) as string;
            const opsRaw = (patchOperations ? JSON.parse(patchOperations) : []) as {
              op: string;
              path: string;
              value?: unknown;
              from?: string;
            }[];
            const patchBody = prepareJsonPatch(opsRaw);
            const res = await cpqApiRequest.call(
              this,
              'PATCH',
              `/settings/user/${encodeURIComponent(userId)}`,
              patchBody,
            );
            returnData.push({ json: res });
          }
        }
      } catch (error) {
        if (continueOnFail) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }

    return this.prepareOutputData(returnData as INodeExecutionData[]);
  }
}
