import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildFiltersFromUi, castUpdateValue } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

const QUOTE_TERM_FIELD_TYPES: Record<string, string> = {
  agreementStartDateDefault: 'string',
  agreementType: 'string',
  authorizeNetIntervalLength: 'integer',
  authorizeNetIntervalUnit: 'string',
  authorizeNetTotalOccurances: 'integer',
  cost: 'number',
  description: 'string',
  discountAmount: 'number',
  discountPercent: 'number',
  downPayment: 'number',
  financingGroup: 'string',
  forceExcludeInForecast: 'boolean',
  forceIncludeInForecast: 'boolean',
  groupSort: 'number',
  id: 'string',
  idLeasingRates: 'string',
  idQuote: 'string',
  idRecurringRevenue: 'string',
  interestRate: 'number',
  intervalToStart: 'integer',
  isAutomaticallyBillable: 'boolean',
  isLease: 'boolean',
  isPrinted: 'boolean',
  isRoundedPayments: 'boolean',
  isSelected: 'boolean',
  leaseDownPayment: 'number',
  leaseMonthlyAmount: 'number',
  leaseRateCardNumber: 'string',
  leaseSource: 'string',
  leaseType: 'string',
  leaseTypeDescription: 'string',
  leasingName: 'string',
  leasingRate: 'number',
  leasingRateOverride: 'number',
  name: 'string',
  nameSort: 'number',
  obeyStandardTabFilters: 'boolean',
  oppRecurringAsAdjustment: 'boolean',
  overrideStartDate: 'string',
  periodInterval: 'string',
  periodPaymentAmount: 'number',
  periods: 'number',
  principal: 'number',
  recurringBeforeDiscount: 'number',
  recurringCost: 'number',
  recurringDiscountAmount: 'number',
  recurringDiscountPercent: 'number',
  recurringPeriods: 'number',
  recurringRevenueLabel: 'string',
  recurringTotalAggregated: 'number',
  recurringTotalAmount: 'number',
  recurringTotalAmountOverride: 'number',
  spreadOneTime: 'boolean',
  startDateMode: 'string',
  subscriptionName: 'string',
  tabExcludeFilter: 'string',
  tabGroup: 'string',
  tabIncludeFilter: 'string',
  tabName: 'string',
  totalAmount: 'number',
  totalAmountOverride: 'number',
};

export const quoteTermsOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quoteTerms'] } },
    options: [
      { name: 'Create', value: 'create', description: 'Create quote term', action: 'Create a quote term' },
      { name: 'Delete', value: 'delete', description: 'Delete quote term', action: 'Delete a quote term' },
      { name: 'Get Many', value: 'getAll', description: 'List quote terms', action: 'Get many quote terms' },
      { name: 'Update', value: 'update', description: 'Update quote term (PATCH)', action: 'Update a quote term' },
    ],
    default: 'getAll',
  },
];

export const quoteTermsFields: INodeProperties[] = [
  {
    displayName: 'Quote ID',
    name: 'quoteId',
    type: 'string',
    required: true,
    default: '',
    description: 'The ID of the quote',
    displayOptions: { show: { resource: ['quoteTerms'], operation: ['getAll', 'create', 'delete', 'update'] } },
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
    displayName: 'Fields to Update',
    name: 'updateFields',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    placeholder: 'Add Field',
    default: {},
    required: true,
    description: 'Fields to update on the quote term. For boolean fields use "true" or "false". For date fields use ISO format (YYYY-MM-DD).',
    displayOptions: { show: { resource: ['quoteTerms'], operation: ['update'] } },
    options: [
      {
        name: 'values',
        displayName: 'Field',
        values: [
          {
            displayName: 'Field',
            name: 'field',
            type: 'options',
            options: [
              { name: 'Agreement Start Date Default', value: 'agreementStartDateDefault' },
              { name: 'Agreement Type', value: 'agreementType' },
              { name: 'Authorize Net Interval Length', value: 'authorizeNetIntervalLength' },
              { name: 'Authorize Net Interval Unit', value: 'authorizeNetIntervalUnit' },
              { name: 'Authorize Net Total Occurances', value: 'authorizeNetTotalOccurances' },
              { name: 'Cost', value: 'cost' },
              { name: 'Description', value: 'description' },
              { name: 'Discount Amount', value: 'discountAmount' },
              { name: 'Discount Percent', value: 'discountPercent' },
              { name: 'Down Payment', value: 'downPayment' },
              { name: 'Financing Group', value: 'financingGroup' },
              { name: 'Force Exclude In Forecast', value: 'forceExcludeInForecast' },
              { name: 'Force Include In Forecast', value: 'forceIncludeInForecast' },
              { name: 'Group Sort', value: 'groupSort' },
              { name: 'ID', value: 'id' },
              { name: 'ID Leasing Rates', value: 'idLeasingRates' },
              { name: 'ID Quote', value: 'idQuote' },
              { name: 'ID Recurring Revenue', value: 'idRecurringRevenue' },
              { name: 'Interest Rate', value: 'interestRate' },
              { name: 'Interval To Start', value: 'intervalToStart' },
              { name: 'Is Automatically Billable', value: 'isAutomaticallyBillable' },
              { name: 'Is Lease', value: 'isLease' },
              { name: 'Is Printed', value: 'isPrinted' },
              { name: 'Is Rounded Payments', value: 'isRoundedPayments' },
              { name: 'Is Selected', value: 'isSelected' },
              { name: 'Lease Down Payment', value: 'leaseDownPayment' },
              { name: 'Lease Monthly Amount', value: 'leaseMonthlyAmount' },
              { name: 'Lease Rate Card Number', value: 'leaseRateCardNumber' },
              { name: 'Lease Source', value: 'leaseSource' },
              { name: 'Lease Type', value: 'leaseType' },
              { name: 'Lease Type Description', value: 'leaseTypeDescription' },
              { name: 'Leasing Name', value: 'leasingName' },
              { name: 'Leasing Rate', value: 'leasingRate' },
              { name: 'Leasing Rate Override', value: 'leasingRateOverride' },
              { name: 'Name', value: 'name' },
              { name: 'Name Sort', value: 'nameSort' },
              { name: 'Obey Standard Tab Filters', value: 'obeyStandardTabFilters' },
              { name: 'Opp Recurring As Adjustment', value: 'oppRecurringAsAdjustment' },
              { name: 'Override Start Date', value: 'overrideStartDate' },
              { name: 'Period Interval', value: 'periodInterval' },
              { name: 'Period Payment Amount', value: 'periodPaymentAmount' },
              { name: 'Periods', value: 'periods' },
              { name: 'Principal', value: 'principal' },
              { name: 'Recurring Before Discount', value: 'recurringBeforeDiscount' },
              { name: 'Recurring Cost', value: 'recurringCost' },
              { name: 'Recurring Discount Amount', value: 'recurringDiscountAmount' },
              { name: 'Recurring Discount Percent', value: 'recurringDiscountPercent' },
              { name: 'Recurring Periods', value: 'recurringPeriods' },
              { name: 'Recurring Revenue Label', value: 'recurringRevenueLabel' },
              { name: 'Recurring Total Aggregated', value: 'recurringTotalAggregated' },
              { name: 'Recurring Total Amount', value: 'recurringTotalAmount' },
              { name: 'Recurring Total Amount Override', value: 'recurringTotalAmountOverride' },
              { name: 'Spread One Time', value: 'spreadOneTime' },
              { name: 'Start Date Mode', value: 'startDateMode' },
              { name: 'Subscription Name', value: 'subscriptionName' },
              { name: 'Tab Exclude Filter', value: 'tabExcludeFilter' },
              { name: 'Tab Group', value: 'tabGroup' },
              { name: 'Tab Include Filter', value: 'tabIncludeFilter' },
              { name: 'Tab Name', value: 'tabName' },
              { name: 'Total Amount', value: 'totalAmount' },
              { name: 'Total Amount Override', value: 'totalAmountOverride' },
            ],
            default: 'name',
            description: 'The quote term field to update',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'The new value for the field',
          },
        ],
      },
    ],
  },
];

export async function executeQuoteTerms(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const filters = this.getNodeParameter('filters', i, {}) as {
      conditions?: Array<{ field?: string; operator?: string; valueType?: string; value?: string }>;
    };
    const filterLogic = this.getNodeParameter('filterLogic', i, 'and') as 'and' | 'or';
    const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as { rawConditions?: string };
    const conditions = buildFiltersFromUi(filters, filterLogic, additionalOptions.rawConditions);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const limit = this.getNodeParameter('limit', i, 100) as number;

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;

    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
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
        `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'create') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const termJson = this.getNodeParameter('termJson', i) as string;
    const body = termJson ? (JSON.parse(termJson) as IDataObject) : {};
    const res = (await cpqApiRequest.call(this, 'POST', `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`, body)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }

  if (operation === 'delete') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`);
    returnData.push({ json: { id, success: true } });
  }

  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i, {}) as {
      values?: Array<{ field: string; value: string }>;
    };
    const rows = updateFields.values ?? [];
    if (rows.length === 0) {
      throw new NodeOperationError(this.getNode(), 'Add at least one field to update.', { itemIndex: i });
    }
    const ops = rows.map(({ field, value }) => ({
      op: 'replace' as const,
      path: `/${field}`,
      value: castUpdateValue(this.getNode(), i, value, QUOTE_TERM_FIELD_TYPES[field] ?? 'string'),
    }));
    const patchBody = prepareJsonPatch(ops);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }
}
