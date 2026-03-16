import type {
  IExecuteFunctions,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
  INodeExecutionData,
  ILoadOptionsFunctions,
} from 'n8n-workflow';
import type { INodePropertyOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Import API spec to discover available fields per resource
// Note: relies on tsconfig resolveJsonModule
import SellApiSpec from '../../.docs/references/SellAPI.json';
import {
  quotesOperations,
  quotesFields,
  executeQuotes,
  quoteItemsOperations,
  quoteItemsFields,
  executeQuoteItems,
  quoteCustomersOperations,
  quoteCustomersFields,
  executeQuoteCustomers,
  quoteTabsOperations,
  quoteTabsFields,
  executeQuoteTabs,
  quoteTermsOperations,
  quoteTermsFields,
  executeQuoteTerms,
  recurringRevenueOperations,
  recurringRevenueFields,
  executeRecurringRevenue,
  taxCodesOperations,
  taxCodesFields,
  executeTaxCodes,
  templatesOperations,
  templatesFields,
  executeTemplates,
  userOperations,
  userFields,
  executeUser,
} from './resources';

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
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
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
      ...quotesOperations,
      ...quotesFields,
      ...quoteItemsOperations,
      ...quoteItemsFields,
      ...quoteCustomersOperations,
      ...quoteCustomersFields,
      ...quoteTabsOperations,
      ...quoteTabsFields,
      ...quoteTermsOperations,
      ...quoteTermsFields,
      ...recurringRevenueOperations,
      ...recurringRevenueFields,
      ...taxCodesOperations,
      ...taxCodesFields,
      ...templatesOperations,
      ...templatesFields,
      ...userOperations,
      ...userFields,

      // Common optional parameters (scaffold only)
      {
        displayName: 'Add filters below to narrow results. For reference fields, type field/subfield (e.g. manufacturer/name) as an expression in the Field box.',
        name: 'filterNotice',
        type: 'notice',
        displayOptions: { show: { operation: ['getAll'] } },
        default: '',
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'fixedCollection',
        placeholder: 'Add Filter',
        typeOptions: { multipleValues: true },
        displayOptions: { show: { operation: ['getAll'] } },
        default: {},
        description: 'Filter rows joined by the combinator below',
        options: [
          {
            name: 'conditions',
            displayName: 'Filter',
            values: [
              {
                displayName: 'Date',
                name: 'dateValue',
                type: 'dateTime',
                displayOptions: { show: { datePreset: ['onDate', 'beforeDate', 'afterDate'] } },
                default: '',
                description: 'The date to filter on',
              },
              {
                displayName: 'Date Preset',
                name: 'datePreset',
                type: 'options',
                displayOptions: { show: { valueType: ['datetime'] } },
                options: [
                  { name: 'After Date', value: 'afterDate' },
                  { name: 'Before Date', value: 'beforeDate' },
                  { name: 'Custom Range', value: 'customRange' },
                  { name: 'Last 120 Days', value: 'last120days' },
                  { name: 'Last 14 Days', value: 'last14days' },
                  { name: 'Last 180 Days', value: 'last180days' },
                  { name: 'Last 30 Days', value: 'last30days' },
                  { name: 'Last 45 Days', value: 'last45days' },
                  { name: 'Last 60 Days', value: 'last60days' },
                  { name: 'Last 7 Days', value: 'last7days' },
                  { name: 'Last 90 Days', value: 'last90days' },
                  { name: 'Last Month', value: 'lastMonth' },
                  { name: 'Last Quarter', value: 'lastQuarter' },
                  { name: 'Last Week', value: 'lastWeek' },
                  { name: 'Last Year', value: 'lastYear' },
                  { name: 'Next 120 Days', value: 'next120days' },
                  { name: 'Next 14 Days', value: 'next14days' },
                  { name: 'Next 180 Days', value: 'next180days' },
                  { name: 'Next 30 Days', value: 'next30days' },
                  { name: 'Next 45 Days', value: 'next45days' },
                  { name: 'Next 60 Days', value: 'next60days' },
                  { name: 'Next 7 Days', value: 'next7days' },
                  { name: 'Next 90 Days', value: 'next90days' },
                  { name: 'Next Month', value: 'nextMonth' },
                  { name: 'Next Quarter', value: 'nextQuarter' },
                  { name: 'Next Week', value: 'nextWeek' },
                  { name: 'On Date', value: 'onDate' },
                  { name: 'This Month', value: 'thisMonth' },
                  { name: 'This Quarter', value: 'thisQuarter' },
                  { name: 'This Week', value: 'thisWeek' },
                  { name: 'This Year', value: 'thisYear' },
                  { name: 'Today', value: 'today' },
                  { name: 'Tomorrow', value: 'tomorrow' },
                  { name: 'Yesterday', value: 'yesterday' },
                ],
                default: 'last30days',
                description: 'Date filter preset. Resolved at execution time relative to today.',
              },
              {
                displayName: 'End Date',
                name: 'dateRangeEnd',
                type: 'dateTime',
                displayOptions: { show: { datePreset: ['customRange'] } },
                default: '',
                description: 'End of the date range (inclusive)',
              },
              {
                displayName: 'Field Name or ID',
                name: 'field',
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getIncludeFields',
                  loadOptionsDependsOn: ['resource'],
                },
                default: '',
                description: 'API field to filter on. For reference fields type field/subfield as an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
              },
              {
                displayName: 'Operator',
                name: 'operator',
                type: 'options',
                displayOptions: { show: { valueType: ['string', 'integer', 'boolean'] } },
                options: [
                  { name: '!=', value: '!=' },
                  { name: '<', value: '<' },
                  { name: '<=', value: '<=' },
                  { name: '=', value: '=' },
                  { name: '>', value: '>' },
                  { name: '>=', value: '>=' },
                  { name: 'Contains', value: 'contains' },
                  { name: 'In (Comma-Separated List)', value: 'in' },
                  { name: 'Not Contains', value: 'not contains' },
                  { name: 'Not In (Comma-Separated List)', value: 'not in' },
                ],
                default: '=',
              },
              {
                displayName: 'Start Date',
                name: 'dateRangeStart',
                type: 'dateTime',
                displayOptions: { show: { datePreset: ['customRange'] } },
                default: '',
                description: 'Start of the date range (inclusive)',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                displayOptions: { show: { valueType: ['string', 'integer', 'boolean'] } },
                default: '',
                description: 'Value to compare against. For In / Not In, enter comma-separated values (e.g. Acme,Globex). Booleans: true or false.',
              },
              {
                displayName: 'Value Type',
                name: 'valueType',
                type: 'options',
                options: [
                  { name: 'Boolean (True / False)', value: 'boolean' },
                  { name: 'Date', value: 'datetime' },
                  { name: 'Number (Integer)', value: 'integer' },
                  { name: 'String', value: 'string' },
                ],
                default: 'string',
                description: 'How the value is formatted in the API query. For In / Not In, each comma-separated item is formatted by this type.',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Combine Filters Using',
        name: 'filterLogic',
        type: 'options',
        displayOptions: { show: { operation: ['getAll'] } },
        options: [
          { name: 'AND — All Filters Must Match', value: 'and' },
          { name: 'OR — Any Filter Must Match', value: 'or' },
        ],
        default: 'and',
        description: 'How to combine multiple filter rows',
      },
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        displayOptions: { show: { operation: ['getAll'] } },
        default: {},
        options: [
          {
            displayName: 'Raw Conditions',
            name: 'rawConditions',
            type: 'string',
            default: '',
            description: 'Advanced: raw CPQ conditions string ANDed after any filter rows above. E.g. summary = "Acme" and closedFlag = True. Strings in double quotes; dates in [YYYY-MM-DD] brackets; booleans as True/False.',
          },
        ],
      },
      {
        displayName: 'Include Field Names',
        name: 'includeFields',
        type: 'multiOptions',
        displayOptions: { show: { operation: ['getAll'] } },
        typeOptions: {
          loadOptionsMethod: 'getIncludeFields',
          loadOptionsDependsOn: ['resource'],
        },
        default: [],
        description:
          'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
      },
      {
        displayName: 'Show All Versions',
        name: 'showAllVersions',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['getAll'],
            resource: ['quotes', 'quoteItems', 'quoteTabs'],
          },
        },
        default: false,
        description: 'Whether to show all versions (including deleted or archived) where supported',
      },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        displayOptions: { show: { operation: ['getAll', 'getItems'] } },
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
        displayOptions: { show: { operation: ['getAll', 'getItems'], returnAll: [false] } },
      },
    ],
  };

  methods = {
    loadOptions: {
      async getIncludeFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const resource = (this.getCurrentNodeParameter('resource') as string) || 'quotes';
        const resourceToDefinition: Record<string, string> = {
          quotes: 'QuoteView',
          quoteItems: 'QuoteItemView',
          quoteCustomers: 'CustomerView',
          quoteTabs: 'QuoteTabView',
          quoteTerms: 'QuoteTermView',
          recurringRevenue: 'RecurringRevenueView',
          taxCodes: 'TaxCodeView',
          // Templates share the QuoteView schema — the SellAPI spec has no TemplatesView definition
          templates: 'QuoteView',
          user: 'UserView',
        };
        const defName = resourceToDefinition[resource];
        const definitions = (SellApiSpec as unknown as { definitions?: Record<string, { properties?: Record<string, unknown> }> }).definitions;
        const def = definitions && defName ? definitions[defName] : undefined;
        const props = def && (def as { properties?: Record<string, unknown> }).properties ? Object.keys((def as { properties?: Record<string, unknown> }).properties as Record<string, unknown>) : [];
        props.sort((a, b) => a.localeCompare(b));
        return props.map((p) => ({ name: p, value: p }));
      },
    },
  };

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const length = items.length;
    const resource = this.getNodeParameter('resource', 0) as string;
    const continueOnFail = this.continueOnFail();

    const delegatedReturnData: INodeExecutionData[] = [];
    for (let i = 0; i < length; i++) {
      try {
        switch (resource) {
          case 'quotes':
            await executeQuotes.call(this, i, delegatedReturnData);
            break;
          case 'quoteItems':
            await executeQuoteItems.call(this, i, delegatedReturnData);
            break;
          case 'quoteCustomers':
            await executeQuoteCustomers.call(this, i, delegatedReturnData);
            break;
          case 'quoteTabs':
            await executeQuoteTabs.call(this, i, delegatedReturnData);
            break;
          case 'quoteTerms':
            await executeQuoteTerms.call(this, i, delegatedReturnData);
            break;
          case 'recurringRevenue':
            await executeRecurringRevenue.call(this, i, delegatedReturnData);
            break;
          case 'taxCodes':
            await executeTaxCodes.call(this, i, delegatedReturnData);
            break;
          case 'templates':
            await executeTemplates.call(this, i, delegatedReturnData);
            break;
          case 'user':
            await executeUser.call(this, i, delegatedReturnData);
            break;
          default:
            throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`);
        }
      } catch (error) {
        if (continueOnFail) {
          delegatedReturnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }

    return this.prepareOutputData(delegatedReturnData);
  }
}
