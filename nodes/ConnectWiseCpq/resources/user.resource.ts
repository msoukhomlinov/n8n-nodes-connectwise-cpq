import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildFiltersFromUi, castUpdateValue } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

const USER_FIELD_TYPES: Record<string, string> = {
  alwaysRequireManagerApproval: 'boolean',
  approverUserId: 'string',
  baseCurrency: 'string',
  bccEmailAddresses: 'string',
  canAccessAllQuotes: 'boolean',
  defaultSearchQuoteStatus: 'string',
  electronicOrderUser: 'boolean',
  emailAddress: 'string',
  failedLoginCount: 'integer',
  firstName: 'string',
  idProfileTeams: 'string',
  invoiceRepId: 'string',
  isAdministrator: 'boolean',
  isApiUser: 'boolean',
  isApprover: 'boolean',
  isContentManager: 'boolean',
  isDeveloper: 'boolean',
  isInactiveUser: 'boolean',
  isManualWinner: 'boolean',
  isPriceChanger: 'boolean',
  isPublisher: 'boolean',
  isReadOnlyUser: 'boolean',
  isStandardPlus: 'boolean',
  jobTitle: 'string',
  lastName: 'string',
  locationId: 'string',
  managerUserId: 'string',
  messengerId: 'string',
  mobilePhoneNumber: 'string',
  oauthSubscriberId: 'string',
  onBehalfUser: 'string',
  orderPorterEmailAddresses: 'string',
  phoneNumber: 'string',
  presentedName: 'string',
  quotePreface: 'string',
  timeZone: 'string',
  userName: 'string',
  userNotes: 'string',
};

export const userOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['user'] } },
    options: [
      { name: 'Get Many', value: 'getAll', description: 'List users', action: 'Get many users' },
      { name: 'Update', value: 'update', description: 'Update user (PATCH)', action: 'Update a user' },
    ],
    default: 'getAll',
  },
];

export const userFields: INodeProperties[] = [
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['user'], operation: ['update'] } },
  },
  {
    displayName: 'Fields to Update',
    name: 'updateFields',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    placeholder: 'Add Field',
    default: {},
    required: true,
    description: 'Fields to update on the user. For boolean fields use "true" or "false".',
    displayOptions: { show: { resource: ['user'], operation: ['update'] } },
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
              { name: 'Always Require Manager Approval', value: 'alwaysRequireManagerApproval' },
              { name: 'Approver User ID', value: 'approverUserId' },
              { name: 'Base Currency', value: 'baseCurrency' },
              { name: 'Bcc Email Addresses', value: 'bccEmailAddresses' },
              { name: 'Can Access All Quotes', value: 'canAccessAllQuotes' },
              { name: 'Default Search Quote Status', value: 'defaultSearchQuoteStatus' },
              { name: 'Electronic Order User', value: 'electronicOrderUser' },
              { name: 'Email Address', value: 'emailAddress' },
              { name: 'Failed Login Count', value: 'failedLoginCount' },
              { name: 'First Name', value: 'firstName' },
              { name: 'ID Profile Teams', value: 'idProfileTeams' },
              { name: 'Invoice Rep ID', value: 'invoiceRepId' },
              { name: 'Is Administrator', value: 'isAdministrator' },
              { name: 'Is Api User', value: 'isApiUser' },
              { name: 'Is Approver', value: 'isApprover' },
              { name: 'Is Content Manager', value: 'isContentManager' },
              { name: 'Is Developer', value: 'isDeveloper' },
              { name: 'Is Inactive User', value: 'isInactiveUser' },
              { name: 'Is Manual Winner', value: 'isManualWinner' },
              { name: 'Is Price Changer', value: 'isPriceChanger' },
              { name: 'Is Publisher', value: 'isPublisher' },
              { name: 'Is Read Only User', value: 'isReadOnlyUser' },
              { name: 'Is Standard Plus', value: 'isStandardPlus' },
              { name: 'Job Title', value: 'jobTitle' },
              { name: 'Last Name', value: 'lastName' },
              { name: 'Location ID', value: 'locationId' },
              { name: 'Manager User ID', value: 'managerUserId' },
              { name: 'Messenger ID', value: 'messengerId' },
              { name: 'Mobile Phone Number', value: 'mobilePhoneNumber' },
              { name: 'Oauth Subscriber ID', value: 'oauthSubscriberId' },
              { name: 'On Behalf User', value: 'onBehalfUser' },
              { name: 'Order Porter Email Addresses', value: 'orderPorterEmailAddresses' },
              { name: 'Phone Number', value: 'phoneNumber' },
              { name: 'Presented Name', value: 'presentedName' },
              { name: 'Quote Preface', value: 'quotePreface' },
              { name: 'Time Zone', value: 'timeZone' },
              { name: 'User Name', value: 'userName' },
              { name: 'User Notes', value: 'userNotes' },
            ],
            default: 'firstName',
            description: 'The user field to update',
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

export async function executeUser(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> {
  const operation = this.getNodeParameter('operation', i) as string;

  if (operation === 'getAll') {
    const filters = this.getNodeParameter('filters', i, {}) as {
      conditions?: Array<{ field?: string; operator?: string; valueType?: string; value?: string }>;
    };
    const filterLogic = this.getNodeParameter('filterLogic', i, 'and') as 'and' | 'or';
    const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as { rawConditions?: string };
    const conditions = buildFiltersFromUi(filters, filterLogic, additionalOptions.rawConditions);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
    const pageSize = this.getNodeParameter('pageSize', i, 50) as number;
    const limit = this.getNodeParameter('limit', i, 100) as number;
    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;
    if (returnAll) {
      const all = (await cpqApiRequestAllItems.call(
        this,
        '',
        'GET',
        '/settings/user',
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
        '/settings/user',
        {},
        qs as IDataObject,
        {},
        limit,
        effectivePageSize,
      )) as unknown[];
      for (const entry of some as IDataObject[]) returnData.push({ json: entry });
    }
  }

  if (operation === 'update') {
    const userId = this.getNodeParameter('userId', i) as string;
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
      value: castUpdateValue(this.getNode(), i, value, USER_FIELD_TYPES[field] ?? 'string'),
    }));
    const patchBody = prepareJsonPatch(ops);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/settings/user/${encodeURIComponent(userId)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }
}
