import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildFiltersFromUi, castUpdateValue } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const CUSTOMER_FIELD_TYPES: Record<string, string> = {
  accountName: 'string',
  accountNumber: 'string',
  address1: 'string',
  address2: 'string',
  city: 'string',
  companyId: 'string',
  country: 'string',
  customCustomerString1: 'string',
  customCustomerString2: 'string',
  customCustomerString3: 'string',
  customerSource: 'string',
  customerSourceId: 'string',
  dayPhone: 'string',
  description: 'string',
  emailAddress: 'string',
  firstName: 'string',
  integrationId: 'string',
  jobTitle: 'string',
  lastName: 'string',
  locationId: 'string',
  mobilePhone: 'string',
  postalCode: 'string',
  priceLevel: 'string',
  priceLevelName: 'string',
  relationshipSinceDate: 'string',
  state: 'string',
  taxExternalReferenceId: 'string',
  title: 'string',
  userId: 'string',
};

export const quoteCustomersOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['quoteCustomers'] } },
    options: [
      { name: 'Delete', value: 'delete', description: 'Delete quote customer', action: 'Delete a quote customer' },
      { name: 'Get Many', value: 'getAll', description: 'List quote customers for a quote', action: 'Get many quote customers' },
      { name: 'Replace', value: 'replace', description: 'Replace quote customer (PUT)', action: 'Replace a quote customer' },
      { name: 'Update', value: 'update', description: 'Update quote customer (PATCH)', action: 'Update a quote customer' },
    ],
    default: 'getAll',
  },
];

export const quoteCustomersFields: INodeProperties[] = [
  {
    displayName: 'Quote ID',
    name: 'quoteId',
    type: 'string',
    required: true,
    default: '',
    description: 'The ID of the quote',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['getAll', 'update', 'delete', 'replace'] } },
  },
  {
    displayName: 'Customer ID',
    name: 'id',
    type: 'string',
    required: true,
    default: '',
    description: 'Quote customer ID',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['update', 'delete', 'replace'] } },
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
    displayName: 'Fields to Update',
    name: 'updateFields',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    placeholder: 'Add Field',
    default: {},
    required: true,
    description: 'Fields to update on the quote customer. For date fields use ISO format (YYYY-MM-DD).',
    displayOptions: { show: { resource: ['quoteCustomers'], operation: ['update'] } },
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
              { name: 'Account Name', value: 'accountName' },
              { name: 'Account Number', value: 'accountNumber' },
              { name: 'Address1', value: 'address1' },
              { name: 'Address2', value: 'address2' },
              { name: 'City', value: 'city' },
              { name: 'Company ID', value: 'companyId' },
              { name: 'Country', value: 'country' },
              { name: 'Custom Customer String1', value: 'customCustomerString1' },
              { name: 'Custom Customer String2', value: 'customCustomerString2' },
              { name: 'Custom Customer String3', value: 'customCustomerString3' },
              { name: 'Customer Source', value: 'customerSource' },
              { name: 'Customer Source ID', value: 'customerSourceId' },
              { name: 'Day Phone', value: 'dayPhone' },
              { name: 'Description', value: 'description' },
              { name: 'Email Address', value: 'emailAddress' },
              { name: 'First Name', value: 'firstName' },
              { name: 'Integration ID', value: 'integrationId' },
              { name: 'Job Title', value: 'jobTitle' },
              { name: 'Last Name', value: 'lastName' },
              { name: 'Location ID', value: 'locationId' },
              { name: 'Mobile Phone', value: 'mobilePhone' },
              { name: 'Postal Code', value: 'postalCode' },
              { name: 'Price Level', value: 'priceLevel' },
              { name: 'Price Level Name', value: 'priceLevelName' },
              { name: 'Relationship Since Date', value: 'relationshipSinceDate' },
              { name: 'State', value: 'state' },
              { name: 'Tax External Reference ID', value: 'taxExternalReferenceId' },
              { name: 'Title', value: 'title' },
              { name: 'User ID', value: 'userId' },
            ],
            default: 'firstName',
            description: 'The quote customer field to update',
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

export async function executeQuoteCustomers(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
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
        `/api/quotes/${encodeURIComponent(quoteId)}/customers`,
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
        `/api/quotes/${encodeURIComponent(quoteId)}/customers`,
        {},
        qs,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'delete') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    await cpqApiRequest.call(this, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`);
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
      value: castUpdateValue(this.getNode(), i, value, CUSTOMER_FIELD_TYPES[field] ?? 'string'),
    }));
    const patchBody = prepareJsonPatch(ops);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }

  if (operation === 'replace') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    const customerJson = this.getNodeParameter('customerJson', i) as string;
    const body = customerJson ? (JSON.parse(customerJson) as IDataObject) : {};
    const res = (await cpqApiRequest.call(this, 'PUT', `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`, body)) as IDataObject;
    returnData.push({ json: res as IDataObject });
  }
}
