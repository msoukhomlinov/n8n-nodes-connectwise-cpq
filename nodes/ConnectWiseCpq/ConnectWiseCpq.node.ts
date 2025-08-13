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
        displayName: 'Conditions',
        name: 'conditions',
        type: 'string',
        default: '',
        description: 'Advanced: Raw conditions string. Examples: summary = "My text", ID = 123, closedFlag = True, lastUpdated = [2024-01-01T00:00:00Z]. Use operators: &lt;, &lt;=, =, !=, &gt;, &gt;=, contains, like, in, not. Join with and/or. Strings must be in quotes; datetimes in [brackets].',
      },
      {
        displayName: 'Condition Builder',
        name: 'conditionsUi',
        type: 'fixedCollection',
        placeholder: 'Add Condition',
        typeOptions: { multipleValues: true },
        default: {},
        options: [
          {
            name: 'conditions',
            displayName: 'Conditions',
            values: [
									{
										displayName: 'Field Name or ID',
												name: 'field',
												type: 'options',
									typeOptions: {
										loadOptionsMethod: 'getIncludeFields',
										loadOptionsDependsOn: ['resource'],
									},
												default: '',
										description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
											},
											{
												displayName: 'Operator',
												name: 'operator',
												type: 'options',
									options: [
										{ name: '!=', value: '!=' },
										{ name: '<', value: '<' },
										{ name: '<=', value: '<=' },
										{ name: '=', value: '=' },
										{ name: '>', value: '>' },
										{ name: '>=', value: '>=' },
										{ name: 'Contains', value: 'contains' },
										{ name: 'In', value: 'in' },
										{ name: 'Like', value: 'like' },
										{ name: 'Not Contains', value: 'not contains' },
										{ name: 'Not In', value: 'not in' },
									],
												default: '=',
											},
											{
												displayName: 'Reference Subfield',
												name: 'referenceSubfield',
												type: 'string',
												default: '',
												description: 'Optional:	appends as field/subfield for reference filtering (e.g. manufacturer/name)',
											},
											{
												displayName: 'Value',
												name: 'value',
												type: 'string',
												default: '',
											},
											{
												displayName: 'Value Type',
												name: 'valueType',
												type: 'options',
									options: [
										{ name: 'Boolean', value: 'boolean' },
										{ name: 'Datetime (ISO-8601)', value: 'datetime' },
										{ name: 'Integer', value: 'integer' },
										{ name: 'List (Comma-Separated)', value: 'list' },
										{ name: 'String', value: 'string' },
									],
												default: 'string',
											},
											{
												displayName: 'Values',
												name: 'values',
												type: 'string',
												default: '',
												description: 'Comma-separated values. Each value is treated as a string unless the API field expects another type.',
											},
									],
          },
        ],
        description: 'Use this to build conditions visually. All builder rows are joined by the selected Logic.',
      },
      {
        displayName: 'Logic',
        name: 'conditionsLogic',
        type: 'options',
        options: [
          { name: 'AND', value: 'and' },
          { name: 'OR', value: 'or' },
        ],
        default: 'and',
        description: 'How to join multiple builder rows',
      },
      {
        displayName: 'Include Field Names',
        name: 'includeFields',
        type: 'multiOptions',
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
        default: false,
        description: 'Whether to show all versions (including deleted or archived) where supported',
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
        description:
          'Optional. Auto-managed based on Limit when Return All is off, or set to maximum when Return All is on.',
        displayOptions: { show: { returnAll: [false] } },
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
