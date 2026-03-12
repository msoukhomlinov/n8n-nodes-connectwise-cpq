import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { cpqApiRequest, cpqApiRequestAllItems, buildFiltersFromUi, prepareJsonPatch, castUpdateValue } from '../GenericFunctions';
import { MAX_PAGE_SIZE } from './constants';

export const QUOTE_FIELD_TYPES: Record<string, string> = {
  accountName: 'string',
  approvalAmount: 'number',
  approvalComment: 'string',
  approvalMargin: 'number',
  approvalMode: 'string',
  approvalQuoteForm: 'string',
  approvalReason: 'string',
  approvalStatus: 'string',
  approvedByUser: 'string',
  approvedDate: 'string',
  autoTaskQuoteNumber: 'string',
  baseCurrency: 'string',
  contactName: 'string',
  contractEndDate: 'string',
  contractStartDate: 'string',
  costChangesCount: 'integer',
  createDate: 'string',
  createNotes: 'string',
  crmOpGroup: 'string',
  crmOpportunityId: 'string',
  defaultReportList: 'string',
  defaultSuccessListProfile: 'string',
  defaultTermPeriods: 'integer',
  defaultVideoList: 'string',
  deliveredDate: 'string',
  discountAmount: 'number',
  expectedCloseDate: 'string',
  expirationDate: 'string',
  externalReferenceQuoteDemandId: 'string',
  forceManagerApprovalScript: 'boolean',
  greatAmericaDefaultRateCard: 'string',
  grossMargin: 'number',
  grossMarginAmount: 'number',
  gst: 'number',
  gstConverted: 'number',
  htmlAgreement: 'string',
  htmlNotes1: 'string',
  htmlNotes2: 'string',
  includeZeroSuggestedInDiscount: 'boolean',
  insideRep: 'string',
  invoicePostDate: 'string',
  invoicePostStatus: 'string',
  invoicePostUser: 'string',
  isAccepted: 'boolean',
  isArchive: 'boolean',
  isLost: 'boolean',
  isManagerApproved: 'boolean',
  isOrderPorterApproved: 'boolean',
  isQuoteDemand: 'boolean',
  isRequestQuote: 'boolean',
  isRequestTemplate: 'boolean',
  isSent: 'boolean',
  isSuccessListDisabled: 'boolean',
  isTaxCalculated: 'boolean',
  keywords: 'string',
  locationId: 'string',
  longDescription: 'string',
  lostReason: 'string',
  markup: 'number',
  masterAgreement: 'string',
  masterAgreementNumber: 'string',
  modifyDate: 'string',
  name: 'string',
  netMargin: 'number',
  netSuiteSubsidiary: 'string',
  optionalAmount: 'number',
  optionalAmountConverted: 'number',
  orderPorterDownPaymentMinimum: 'number',
  orderPorterDownPaymentPercent: 'number',
  orderPorterEmailSignature: 'string',
  orderPorterFilteredIp: 'string',
  orderPorterFirstVisitDate: 'string',
  orderPorterFullPaymentAllowed: 'boolean',
  orderPorterGroup: 'string',
  orderPorterHasFirstVisitOccurred: 'boolean',
  orderPorterInitialsSig: 'string',
  orderPorterIsUploaded: 'boolean',
  orderPorterPasscode: 'string',
  orderPorterPaymentMode: 'string',
  orderPorterShowImage: 'boolean',
  orderPorterShowItemOptionalCheckbox: 'boolean',
  orderPorterShowLineDetails: 'boolean',
  orderPorterShowQuantity: 'boolean',
  orderPorterShowSignature: 'boolean',
  orderPorterShowTabOptionalCheckbox: 'boolean',
  orderPorterSignedDate: 'string',
  orderPorterSignedIp: 'string',
  orderPorterTemplate: 'string',
  orderPorterTheme: 'string',
  orderPorterVisits: 'integer',
  originalQuoteId: 'string',
  overrideRate: 'number',
  peerReviewDocument: 'string',
  peerReviewStatus: 'string',
  primaryRep: 'string',
  printPackageHeaderPrice: 'boolean',
  printPackageItemPrice: 'boolean',
  probability: 'number',
  promiseDate: 'string',
  promiseDateChangesCount: 'integer',
  pst: 'number',
  pstConverted: 'number',
  publishNumber: 'integer',
  purchaseOrderNumber: 'string',
  quickbooksTemplate: 'string',
  quoteCost: 'number',
  quoteCreator: 'string',
  quoteNotes: 'string',
  quoteNumber: 'integer',
  quotePreface: 'string',
  quoteTotal: 'number',
  quoteType: 'string',
  quoteVersion: 'integer',
  recurringCost: 'number',
  recurringDiscountAmount: 'number',
  recurringGst: 'number',
  recurringOptionalAmount: 'number',
  recurringPst: 'number',
  recurringSubtotal: 'number',
  recurringSuggestedDiscountAmount: 'number',
  recurringSuggestedTotal: 'number',
  recurringTax: 'number',
  recurringTotal: 'number',
  requestDate: 'string',
  requestedBy: 'string',
  requestId: 'string',
  requiresApproval: 'boolean',
  requiresNameChange: 'boolean',
  salesForceDefaultOppType: 'string',
  salesForceDefaultPriceList: 'string',
  salesForceDefaultRecurringTermType: 'string',
  selectedTermsTotal: 'number',
  shippingSubtotal: 'number',
  shippingTax: 'number',
  shortDescription: 'string',
  showOrderPorterESign: 'boolean',
  showPackageHeader: 'boolean',
  showPackageItems: 'boolean',
  sourceCampaignId: 'string',
  subtotal: 'number',
  subtotalConverted: 'number',
  suggestedDiscountAmount: 'number',
  suggestedTotal: 'number',
  targetDate: 'string',
  tax: 'number',
  taxCode: 'string',
  taxRate: 'number',
  termsAndConditions: 'string',
  versionComment: 'string',
  winForm: 'string',
  wonOrLostDate: 'string',
  quoteStatus: 'string',
  zCustomQuoteBool1: 'boolean',
  zCustomQuoteBool10: 'boolean',
  zCustomQuoteBool2: 'boolean',
  zCustomQuoteBool3: 'boolean',
  zCustomQuoteBool4: 'boolean',
  zCustomQuoteBool5: 'boolean',
  zCustomQuoteBool6: 'boolean',
  zCustomQuoteBool7: 'boolean',
  zCustomQuoteBool8: 'boolean',
  zCustomQuoteBool9: 'boolean',
  zCustomQuoteDate1: 'string',
  zCustomQuoteDate2: 'string',
  zCustomQuoteDecimal1: 'number',
  zCustomQuoteDecimal10: 'number',
  zCustomQuoteDecimal11: 'number',
  zCustomQuoteDecimal12: 'number',
  zCustomQuoteDecimal13: 'number',
  zCustomQuoteDecimal14: 'number',
  zCustomQuoteDecimal15: 'number',
  zCustomQuoteDecimal16: 'number',
  zCustomQuoteDecimal17: 'number',
  zCustomQuoteDecimal18: 'number',
  zCustomQuoteDecimal19: 'number',
  zCustomQuoteDecimal2: 'number',
  zCustomQuoteDecimal20: 'number',
  zCustomQuoteDecimal3: 'number',
  zCustomQuoteDecimal4: 'number',
  zCustomQuoteDecimal5: 'number',
  zCustomQuoteDecimal6: 'number',
  zCustomQuoteDecimal7: 'number',
  zCustomQuoteDecimal8: 'number',
  zCustomQuoteDecimal9: 'number',
  zCustomQuoteString1: 'string',
  zCustomQuoteString10: 'string',
  zCustomQuoteString11: 'string',
  zCustomQuoteString12: 'string',
  zCustomQuoteString13: 'string',
  zCustomQuoteString14: 'string',
  zCustomQuoteString15: 'string',
  zCustomQuoteString2: 'string',
  zCustomQuoteString3: 'string',
  zCustomQuoteString4: 'string',
  zCustomQuoteString5: 'string',
  zCustomQuoteString6: 'string',
  zCustomQuoteString7: 'string',
  zCustomQuoteString8: 'string',
  zCustomQuoteString9: 'string',
};

/**
 * Returns true for the legacy UUID-format quote ID (e.g. 2710b955-04f8-47ed-9e26-ea57ed41519c).
 * These quotes cannot be modified via the REST API — the server throws 500 on any PATCH/DELETE.
 * Newer quotes use an alphanumeric format (e.g. q639088936162812241alWXeGX) and work correctly.
 */
export function isLegacyQuoteId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * AND-appends `extra` to `base`, wrapping base in parens if it contains OR logic.
 */
export function appendConditions(base: string, extra: string): string {
  if (!extra) return base;
  if (!base) return extra;
  const wrappedBase = /\bOR\b/i.test(base) ? `(${base})` : base;
  return `${wrappedBase} AND ${extra}`;
}

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
        description: 'Delete a specific version of a quote by user-visible quote number and version number',
        action: 'Delete a quote version',
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Get a quote by internal system ID (the id field, not the user-visible quote number)',
        action: 'Get a quote',
      },
      {
        name: 'Get by Quote Number',
        value: 'getLatestVersion',
        description: 'Get a quote by user-visible quote number (quoteNumber field, not the internal system id)',
        action: 'Get a quote by quote number',
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
        description: 'Get a specific version of a quote by user-visible quote number and version number',
        action: 'Get a quote version',
      },
      {
        name: 'Get Versions',
        value: 'getVersions',
        description: 'Get all versions of a quote by user-visible quote number',
        action: 'Get all quote versions',
      },
      {
        name: 'Close as Lost',
        value: 'closeAsLost',
        description: 'Mark a quote as Lost. Sets quoteStatus and wonOrLostDate in one operation.',
        action: 'Close a quote as lost',
      },
      {
        name: 'Close as No Decision',
        value: 'closeAsNoDecision',
        description: 'Mark a quote as No Decision. Sets quoteStatus and wonOrLostDate in one operation.',
        action: 'Close a quote as no decision',
      },
      {
        name: 'Close as Won',
        value: 'closeAsWon',
        description: 'Mark a quote as Won. Sets quoteStatus and wonOrLostDate in one operation.',
        action: 'Close a quote as won',
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
    displayName: 'Quote Status',
    name: 'quoteStatus',
    type: 'options',
    displayOptions: { show: { resource: ['quotes'], operation: ['getAll'] } },
    options: [
      { name: 'Active',               value: 'active' },
      { name: 'All',                  value: 'all' },
      { name: 'All Closed',           value: 'allClosed' },
      { name: 'Archived',             value: 'archived' },
      { name: 'Closed - Lost',        value: 'lost' },
      { name: 'Closed - No Decision', value: 'noDecision' },
      { name: 'Closed - Won',         value: 'won' },
      { name: 'Deleted',              value: 'deleted' },
    ],
    default: 'all',
    description: 'Filter by quote status. "Active" means open/in-play. Closed options filter by a specific outcome. "All Closed" matches any non-Active status.',
  },
  {
    displayName: 'Expired Only',
    name: 'expiredOnly',
    type: 'boolean',
    displayOptions: { show: { resource: ['quotes'], operation: ['getAll'] } },
    default: false,
    description: 'Whether to return only quotes whose expiration date is in the past. Most useful combined with Quote Status = Active.',
  },
  {
    displayName: 'ID Format',
    name: 'idFormat',
    type: 'options',
    displayOptions: { show: { resource: ['quotes'], operation: ['getAll'] } },
    options: [
      { name: 'All', value: 'all' },
      { name: 'New Format Only (API-writable)', value: 'newOnly' },
      { name: 'Legacy Format Only (read-only via API)', value: 'legacyOnly' },
    ],
    default: 'all',
    description: 'Filter results by quote ID format. Legacy quotes (UUID format) cannot be modified via the API — use "New Format Only" to return only quotes that support update/close/delete operations.',
  },
  {
    displayName: 'Quote ID',
    name: 'quoteId',
    type: 'string',
    required: true,
    default: '',
    description: 'The internal system ID of the quote (id field from API results, not the user-visible quote number)',
    displayOptions: { show: { resource: ['quotes'], operation: ['get', 'delete', 'copy', 'update', 'closeAsLost', 'closeAsNoDecision', 'closeAsWon'] } },
  },
  {
    displayName: 'Lost/No-Decision Reason',
    name: 'lostReason',
    type: 'string',
    default: '',
    description: 'Optional reason the quote was lost or resulted in no decision',
    displayOptions: { show: { resource: ['quotes'], operation: ['closeAsLost', 'closeAsNoDecision'] } },
  },
  {
    displayName: 'Won Reason',
    name: 'winForm',
    type: 'string',
    default: '',
    description: 'Optional reason the quote was won',
    displayOptions: { show: { resource: ['quotes'], operation: ['closeAsWon'] } },
  },
  {
    displayName: 'Won/Lost Date',
    name: 'wonOrLostDate',
    type: 'dateTime',
    default: '',
    description: 'Date/time the quote was closed. Defaults to now if left blank.',
    displayOptions: { show: { resource: ['quotes'], operation: ['closeAsLost', 'closeAsNoDecision', 'closeAsWon'] } },
  },
  {
    displayName: 'Quote Number',
    name: 'quoteNumber',
    type: 'number',
    required: true,
    default: 0,
    description: 'The user-visible quote number (quoteNumber integer users see in CPQ, not the internal system id)',
    displayOptions: { show: { resource: ['quotes'], operation: ['getVersions', 'getLatestVersion', 'getVersion', 'deleteVersion'] } },
  },
  {
    displayName: 'Quote Version',
    name: 'quoteVersion',
    type: 'number',
    required: true,
    default: 0,
    description: 'The version number of the quote (positive integer)',
    displayOptions: { show: { resource: ['quotes'], operation: ['getVersion', 'deleteVersion'] } },
  },
  {
    displayName: 'Fields to Update',
    name: 'updateFields',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    placeholder: 'Add Field',
    default: {},
    required: true,
    description: 'Fields to update on the quote. For boolean fields use "true" or "false". For date fields use ISO format (YYYY-MM-DD). To close as lost: set Quote Status = "Lost" (preferred), or set Is Lost = true AND Won Or Lost Date together — setting Is Lost alone returns a 500 error.',
    displayOptions: { show: { resource: ['quotes'], operation: ['update'] } },
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
              { name: 'Approval Amount', value: 'approvalAmount' },
              { name: 'Approval Comment', value: 'approvalComment' },
              { name: 'Approval Margin', value: 'approvalMargin' },
              { name: 'Approval Mode', value: 'approvalMode' },
              { name: 'Approval Quote Form', value: 'approvalQuoteForm' },
              { name: 'Approval Reason', value: 'approvalReason' },
              { name: 'Approval Status', value: 'approvalStatus' },
              { name: 'Approved By User', value: 'approvedByUser' },
              { name: 'Approved Date', value: 'approvedDate' },
              { name: 'Auto Task Quote Number', value: 'autoTaskQuoteNumber' },
              { name: 'Base Currency', value: 'baseCurrency' },
              { name: 'Contact Name', value: 'contactName' },
              { name: 'Contract End Date', value: 'contractEndDate' },
              { name: 'Contract Start Date', value: 'contractStartDate' },
              { name: 'Cost Changes Count', value: 'costChangesCount' },
              { name: 'Create Date', value: 'createDate' },
              { name: 'Create Notes', value: 'createNotes' },
              { name: 'Crm Op Group', value: 'crmOpGroup' },
              { name: 'Crm Opportunity ID', value: 'crmOpportunityId' },
              { name: 'Default Report List', value: 'defaultReportList' },
              { name: 'Default Success List Profile', value: 'defaultSuccessListProfile' },
              { name: 'Default Term Periods', value: 'defaultTermPeriods' },
              { name: 'Default Video List', value: 'defaultVideoList' },
              { name: 'Delivered Date', value: 'deliveredDate' },
              { name: 'Discount Amount', value: 'discountAmount' },
              { name: 'Expected Close Date', value: 'expectedCloseDate' },
              { name: 'Expiration Date', value: 'expirationDate' },
              { name: 'External Reference Quote Demand ID', value: 'externalReferenceQuoteDemandId' },
              { name: 'Force Manager Approval Script', value: 'forceManagerApprovalScript' },
              { name: 'Great America Default Rate Card', value: 'greatAmericaDefaultRateCard' },
              { name: 'Gross Margin', value: 'grossMargin' },
              { name: 'Gross Margin Amount', value: 'grossMarginAmount' },
              { name: 'Gst', value: 'gst' },
              { name: 'Gst Converted', value: 'gstConverted' },
              { name: 'Html Agreement', value: 'htmlAgreement' },
              { name: 'Html Notes1', value: 'htmlNotes1' },
              { name: 'Html Notes2', value: 'htmlNotes2' },
              { name: 'Include Zero Suggested In Discount', value: 'includeZeroSuggestedInDiscount' },
              { name: 'Inside Rep', value: 'insideRep' },
              { name: 'Invoice Post Date', value: 'invoicePostDate' },
              { name: 'Invoice Post Status', value: 'invoicePostStatus' },
              { name: 'Invoice Post User', value: 'invoicePostUser' },
              { name: 'Is Accepted', value: 'isAccepted' },
              { name: 'Is Archive', value: 'isArchive' },
              { name: 'Is Lost (also set Won Or Lost Date)', value: 'isLost' },
              { name: 'Is Manager Approved', value: 'isManagerApproved' },
              { name: 'Is Order Porter Approved', value: 'isOrderPorterApproved' },
              { name: 'Is Quote Demand', value: 'isQuoteDemand' },
              { name: 'Is Request Quote', value: 'isRequestQuote' },
              { name: 'Is Request Template', value: 'isRequestTemplate' },
              { name: 'Is Sent', value: 'isSent' },
              { name: 'Is Success List Disabled', value: 'isSuccessListDisabled' },
              { name: 'Is Tax Calculated', value: 'isTaxCalculated' },
              { name: 'Keywords', value: 'keywords' },
              { name: 'Location ID', value: 'locationId' },
              { name: 'Long Description', value: 'longDescription' },
              { name: 'Lost Reason', value: 'lostReason' },
              { name: 'Markup', value: 'markup' },
              { name: 'Master Agreement', value: 'masterAgreement' },
              { name: 'Master Agreement Number', value: 'masterAgreementNumber' },
              { name: 'Modify Date', value: 'modifyDate' },
              { name: 'Name', value: 'name' },
              { name: 'Net Margin', value: 'netMargin' },
              { name: 'Net Suite Subsidiary', value: 'netSuiteSubsidiary' },
              { name: 'Optional Amount', value: 'optionalAmount' },
              { name: 'Optional Amount Converted', value: 'optionalAmountConverted' },
              { name: 'Order Porter Down Payment Minimum', value: 'orderPorterDownPaymentMinimum' },
              { name: 'Order Porter Down Payment Percent', value: 'orderPorterDownPaymentPercent' },
              { name: 'Order Porter Email Signature', value: 'orderPorterEmailSignature' },
              { name: 'Order Porter Filtered Ip', value: 'orderPorterFilteredIp' },
              { name: 'Order Porter First Visit Date', value: 'orderPorterFirstVisitDate' },
              { name: 'Order Porter Full Payment Allowed', value: 'orderPorterFullPaymentAllowed' },
              { name: 'Order Porter Group', value: 'orderPorterGroup' },
              { name: 'Order Porter Has First Visit Occurred', value: 'orderPorterHasFirstVisitOccurred' },
              { name: 'Order Porter Initials Sig', value: 'orderPorterInitialsSig' },
              { name: 'Order Porter Is Uploaded', value: 'orderPorterIsUploaded' },
              { name: 'Order Porter Passcode', value: 'orderPorterPasscode' },
              { name: 'Order Porter Payment Mode', value: 'orderPorterPaymentMode' },
              { name: 'Order Porter Show Image', value: 'orderPorterShowImage' },
              { name: 'Order Porter Show Item Optional Checkbox', value: 'orderPorterShowItemOptionalCheckbox' },
              { name: 'Order Porter Show Line Details', value: 'orderPorterShowLineDetails' },
              { name: 'Order Porter Show Quantity', value: 'orderPorterShowQuantity' },
              { name: 'Order Porter Show Signature', value: 'orderPorterShowSignature' },
              { name: 'Order Porter Show Tab Optional Checkbox', value: 'orderPorterShowTabOptionalCheckbox' },
              { name: 'Order Porter Signed Date', value: 'orderPorterSignedDate' },
              { name: 'Order Porter Signed Ip', value: 'orderPorterSignedIp' },
              { name: 'Order Porter Template', value: 'orderPorterTemplate' },
              { name: 'Order Porter Theme', value: 'orderPorterTheme' },
              { name: 'Order Porter Visits', value: 'orderPorterVisits' },
              { name: 'Original Quote ID', value: 'originalQuoteId' },
              { name: 'Override Rate', value: 'overrideRate' },
              { name: 'Peer Review Document', value: 'peerReviewDocument' },
              { name: 'Peer Review Status', value: 'peerReviewStatus' },
              { name: 'Primary Rep', value: 'primaryRep' },
              { name: 'Print Package Header Price', value: 'printPackageHeaderPrice' },
              { name: 'Print Package Item Price', value: 'printPackageItemPrice' },
              { name: 'Probability', value: 'probability' },
              { name: 'Promise Date', value: 'promiseDate' },
              { name: 'Promise Date Changes Count', value: 'promiseDateChangesCount' },
              { name: 'Pst', value: 'pst' },
              { name: 'Pst Converted', value: 'pstConverted' },
              { name: 'Publish Number', value: 'publishNumber' },
              { name: 'Purchase Order Number', value: 'purchaseOrderNumber' },
              { name: 'Quickbooks Template', value: 'quickbooksTemplate' },
              { name: 'Quote Cost', value: 'quoteCost' },
              { name: 'Quote Creator', value: 'quoteCreator' },
              { name: 'Quote Notes', value: 'quoteNotes' },
              { name: 'Quote Number', value: 'quoteNumber' },
              { name: 'Quote Preface', value: 'quotePreface' },
              { name: 'Quote Total', value: 'quoteTotal' },
              { name: 'Quote Status', value: 'quoteStatus' },
              { name: 'Quote Type', value: 'quoteType' },
              { name: 'Quote Version', value: 'quoteVersion' },
              { name: 'Recurring Cost', value: 'recurringCost' },
              { name: 'Recurring Discount Amount', value: 'recurringDiscountAmount' },
              { name: 'Recurring Gst', value: 'recurringGst' },
              { name: 'Recurring Optional Amount', value: 'recurringOptionalAmount' },
              { name: 'Recurring Pst', value: 'recurringPst' },
              { name: 'Recurring Subtotal', value: 'recurringSubtotal' },
              { name: 'Recurring Suggested Discount Amount', value: 'recurringSuggestedDiscountAmount' },
              { name: 'Recurring Suggested Total', value: 'recurringSuggestedTotal' },
              { name: 'Recurring Tax', value: 'recurringTax' },
              { name: 'Recurring Total', value: 'recurringTotal' },
              { name: 'Request Date', value: 'requestDate' },
              { name: 'Request ID', value: 'requestId' },
              { name: 'Requested By', value: 'requestedBy' },
              { name: 'Requires Approval', value: 'requiresApproval' },
              { name: 'Requires Name Change', value: 'requiresNameChange' },
              { name: 'Sales Force Default Opp Type', value: 'salesForceDefaultOppType' },
              { name: 'Sales Force Default Price List', value: 'salesForceDefaultPriceList' },
              { name: 'Sales Force Default Recurring Term Type', value: 'salesForceDefaultRecurringTermType' },
              { name: 'Selected Terms Total', value: 'selectedTermsTotal' },
              { name: 'Shipping Subtotal', value: 'shippingSubtotal' },
              { name: 'Shipping Tax', value: 'shippingTax' },
              { name: 'Short Description', value: 'shortDescription' },
              { name: 'Show Order Porter E Sign', value: 'showOrderPorterESign' },
              { name: 'Show Package Header', value: 'showPackageHeader' },
              { name: 'Show Package Items', value: 'showPackageItems' },
              { name: 'Source Campaign ID', value: 'sourceCampaignId' },
              { name: 'Subtotal', value: 'subtotal' },
              { name: 'Subtotal Converted', value: 'subtotalConverted' },
              { name: 'Suggested Discount Amount', value: 'suggestedDiscountAmount' },
              { name: 'Suggested Total', value: 'suggestedTotal' },
              { name: 'Target Date', value: 'targetDate' },
              { name: 'Tax', value: 'tax' },
              { name: 'Tax Code', value: 'taxCode' },
              { name: 'Tax Rate', value: 'taxRate' },
              { name: 'Terms And Conditions', value: 'termsAndConditions' },
              { name: 'Version Comment', value: 'versionComment' },
              { name: 'Win Form', value: 'winForm' },
              { name: 'Won Or Lost Date', value: 'wonOrLostDate' },
              { name: 'Z Custom Quote Bool1', value: 'zCustomQuoteBool1' },
              { name: 'Z Custom Quote Bool10', value: 'zCustomQuoteBool10' },
              { name: 'Z Custom Quote Bool2', value: 'zCustomQuoteBool2' },
              { name: 'Z Custom Quote Bool3', value: 'zCustomQuoteBool3' },
              { name: 'Z Custom Quote Bool4', value: 'zCustomQuoteBool4' },
              { name: 'Z Custom Quote Bool5', value: 'zCustomQuoteBool5' },
              { name: 'Z Custom Quote Bool6', value: 'zCustomQuoteBool6' },
              { name: 'Z Custom Quote Bool7', value: 'zCustomQuoteBool7' },
              { name: 'Z Custom Quote Bool8', value: 'zCustomQuoteBool8' },
              { name: 'Z Custom Quote Bool9', value: 'zCustomQuoteBool9' },
              { name: 'Z Custom Quote Date1', value: 'zCustomQuoteDate1' },
              { name: 'Z Custom Quote Date2', value: 'zCustomQuoteDate2' },
              { name: 'Z Custom Quote Decimal1', value: 'zCustomQuoteDecimal1' },
              { name: 'Z Custom Quote Decimal10', value: 'zCustomQuoteDecimal10' },
              { name: 'Z Custom Quote Decimal11', value: 'zCustomQuoteDecimal11' },
              { name: 'Z Custom Quote Decimal12', value: 'zCustomQuoteDecimal12' },
              { name: 'Z Custom Quote Decimal13', value: 'zCustomQuoteDecimal13' },
              { name: 'Z Custom Quote Decimal14', value: 'zCustomQuoteDecimal14' },
              { name: 'Z Custom Quote Decimal15', value: 'zCustomQuoteDecimal15' },
              { name: 'Z Custom Quote Decimal16', value: 'zCustomQuoteDecimal16' },
              { name: 'Z Custom Quote Decimal17', value: 'zCustomQuoteDecimal17' },
              { name: 'Z Custom Quote Decimal18', value: 'zCustomQuoteDecimal18' },
              { name: 'Z Custom Quote Decimal19', value: 'zCustomQuoteDecimal19' },
              { name: 'Z Custom Quote Decimal2', value: 'zCustomQuoteDecimal2' },
              { name: 'Z Custom Quote Decimal20', value: 'zCustomQuoteDecimal20' },
              { name: 'Z Custom Quote Decimal3', value: 'zCustomQuoteDecimal3' },
              { name: 'Z Custom Quote Decimal4', value: 'zCustomQuoteDecimal4' },
              { name: 'Z Custom Quote Decimal5', value: 'zCustomQuoteDecimal5' },
              { name: 'Z Custom Quote Decimal6', value: 'zCustomQuoteDecimal6' },
              { name: 'Z Custom Quote Decimal7', value: 'zCustomQuoteDecimal7' },
              { name: 'Z Custom Quote Decimal8', value: 'zCustomQuoteDecimal8' },
              { name: 'Z Custom Quote Decimal9', value: 'zCustomQuoteDecimal9' },
              { name: 'Z Custom Quote String1', value: 'zCustomQuoteString1' },
              { name: 'Z Custom Quote String10', value: 'zCustomQuoteString10' },
              { name: 'Z Custom Quote String11', value: 'zCustomQuoteString11' },
              { name: 'Z Custom Quote String12', value: 'zCustomQuoteString12' },
              { name: 'Z Custom Quote String13', value: 'zCustomQuoteString13' },
              { name: 'Z Custom Quote String14', value: 'zCustomQuoteString14' },
              { name: 'Z Custom Quote String15', value: 'zCustomQuoteString15' },
              { name: 'Z Custom Quote String2', value: 'zCustomQuoteString2' },
              { name: 'Z Custom Quote String3', value: 'zCustomQuoteString3' },
              { name: 'Z Custom Quote String4', value: 'zCustomQuoteString4' },
              { name: 'Z Custom Quote String5', value: 'zCustomQuoteString5' },
              { name: 'Z Custom Quote String6', value: 'zCustomQuoteString6' },
              { name: 'Z Custom Quote String7', value: 'zCustomQuoteString7' },
              { name: 'Z Custom Quote String8', value: 'zCustomQuoteString8' },
              { name: 'Z Custom Quote String9', value: 'zCustomQuoteString9' },
            ],
            default: 'name',
            description: 'The quote field to update',
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
    const filters = this.getNodeParameter('filters', i, {}) as {
      conditions?: Array<{ field?: string; operator?: string; valueType?: string; value?: string }>;
    };
    const filterLogic = this.getNodeParameter('filterLogic', i, 'and') as 'and' | 'or';
    const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as { rawConditions?: string };
    const baseConditions = buildFiltersFromUi(filters, filterLogic, additionalOptions.rawConditions);
    const includeFieldsRaw = this.getNodeParameter('includeFields', i, '') as string | string[];
    const includeFields = Array.isArray(includeFieldsRaw) ? includeFieldsRaw.join(',') : includeFieldsRaw;
    const showAllVersions = this.getNodeParameter('showAllVersions', i, false) as boolean;
    const quoteStatus = this.getNodeParameter('quoteStatus', i, 'all') as string;
    const expiredOnly = this.getNodeParameter('expiredOnly', i, false) as boolean;
    const idFormat = this.getNodeParameter('idFormat', i, 'all') as string;

    const extraParts: string[] = [];
    if (quoteStatus === 'allClosed') {
      extraParts.push('quoteStatus != "Active"');
    } else if (quoteStatus !== 'all') {
      const statusValueMap: Record<string, string> = {
        active:     'Active',
        archived:   'Archived',
        deleted:    'Deleted',
        lost:       'Lost',
        noDecision: 'No Decision',
        won:        'Won',
      };
      const apiValue = statusValueMap[quoteStatus];
      if (apiValue) extraParts.push(`quoteStatus = "${apiValue}"`);
    }
    if (expiredOnly) {
      const today = new Date().toISOString().split('T')[0];
      extraParts.push(`expirationDate < [${today}]`);
    }
    // Push ID format filter server-side so it applies before pagination.
    // New-format IDs start with 'q'; UUID IDs use hex chars (0-9, a-f) which sort before 'q'.
    if (idFormat === 'newOnly') {
      extraParts.push('id >= "q" AND id < "r"');
    } else if (idFormat === 'legacyOnly') {
      extraParts.push('id < "q"');
    }
    const conditions = appendConditions(baseConditions ?? '', extraParts.join(' AND '));

    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (includeFields) qs.includeFields = includeFields;
    if (showAllVersions) qs.showAllVersions = showAllVersions;

    let results: IDataObject[];

    if (returnAll) {
      results = (await cpqApiRequestAllItems.call(
        this, '', 'GET', '/api/quotes', {}, qs as IDataObject, {}, undefined, MAX_PAGE_SIZE,
      )) as IDataObject[];
    } else {
      const effectivePageSize = Math.min(typeof limit === 'number' ? limit : pageSize, MAX_PAGE_SIZE);
      results = (await cpqApiRequestAllItems.call(
        this, '', 'GET', '/api/quotes', {}, qs as IDataObject, {}, limit, effectivePageSize,
      )) as IDataObject[];
    }

    for (const entry of results) returnData.push({ json: entry });
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

  if (operation === 'closeAsLost' || operation === 'closeAsNoDecision' || operation === 'closeAsWon') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    if (isLegacyQuoteId(quoteId)) {
      throw new NodeOperationError(
        this.getNode(),
        `Quote ID "${quoteId}" uses the legacy UUID format. The ConnectWise CPQ API does not support PATCH operations on legacy quotes — close operations (Lost, Won, No Decision) require PATCH and will return a 500 error. Use the Delete operation instead (which does work on legacy quotes), or close the quote manually in the CPQ GUI.`,
        { itemIndex: i },
      );
    }
    const wonOrLostDateRaw = this.getNodeParameter('wonOrLostDate', i, '') as string;
    const closedDate = wonOrLostDateRaw ? new Date(wonOrLostDateRaw).toISOString() : new Date().toISOString();
    const statusMap: Record<string, string> = { closeAsLost: 'Lost', closeAsNoDecision: 'No Decision', closeAsWon: 'Won' };
    const status = statusMap[operation];

    const ops: Array<{ op: 'replace'; path: string; value: unknown }> = [
      { op: 'replace', path: '/quoteStatus', value: status },
      { op: 'replace', path: '/wonOrLostDate', value: closedDate },
    ];

    if (operation === 'closeAsLost' || operation === 'closeAsNoDecision') {
      const lostReason = this.getNodeParameter('lostReason', i, '') as string;
      if (lostReason) ops.push({ op: 'replace', path: '/lostReason', value: lostReason });
    }

    if (operation === 'closeAsWon') {
      const winForm = this.getNodeParameter('winForm', i, '') as string;
      if (winForm) ops.push({ op: 'replace', path: '/winForm', value: winForm });
    }


    const patchBody = prepareJsonPatch(ops);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }

  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    if (isLegacyQuoteId(quoteId)) {
      throw new NodeOperationError(
        this.getNode(),
        `Quote ID "${quoteId}" uses the legacy UUID format. The ConnectWise CPQ API does not support PATCH operations on legacy quotes and returns a 500 error. Only quotes with the newer alphanumeric ID format (e.g. q639088936162812241alWXeGX) can be updated via the API.`,
        { itemIndex: i },
      );
    }
    const updateFields = this.getNodeParameter('updateFields', i, {}) as {
      values?: Array<{ field: string; value: string }>;
    };
    const rows = updateFields.values ?? [];
    if (rows.length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'Add at least one field to update.',
        { itemIndex: i },
      );
    }
    const ops = rows.map(({ field, value }) => ({
      op: 'replace' as const,
      path: `/${field}`,
      value: castUpdateValue(this.getNode(), i, value, QUOTE_FIELD_TYPES[field] ?? 'string'),
    }));
    const patchBody = prepareJsonPatch(ops);
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
