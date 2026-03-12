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
  quoteStatus: 'string',
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

// ── Synthetic status helpers ──────────────────────────────────────────────

/** Precedence-ordered status label for a quote object. Always computed from raw fields. */
export function computeSyntheticStatus(q: IDataObject): string {
  if (q.isArchive === true) return 'Archived';
  if (q.isLost === true) return 'Lost';
  if (q.invoicePostStatus === 'Posted') return 'Invoiced';
  if (q.isAccepted === true) return 'Accepted / Won';
  if (q.isManagerApproved === true && q.isAccepted === false) return 'Manager Approved';
  if (q.approvalStatus !== undefined && q.approvalStatus !== 'None' && q.isManagerApproved === false)
    return 'Pending Approval';
  if (q.isSent === true) return 'Sent';
  return 'Draft';
}

const STATUS_CONDITIONS: Record<string, string> = {
  archived:         'isArchive = True',
  lost:             'isLost = True',
  invoiced:         'invoicePostStatus = "Posted"',
  acceptedWon:      'isAccepted = True AND isArchive = False AND isLost = False AND invoicePostStatus != "Posted"',
  managerApproved:  'isManagerApproved = True AND isAccepted = False AND isLost = False AND isArchive = False',
  pendingApproval:  'approvalStatus != "None" AND isManagerApproved = False AND isAccepted = False AND isLost = False AND isArchive = False',
  sent:             'isSent = True AND isAccepted = False AND isLost = False AND isArchive = False AND invoicePostStatus != "Posted"',
  draft:            'isArchive = False AND isLost = False AND invoicePostStatus != "Posted" AND isAccepted = False AND isManagerApproved = False AND approvalStatus = "None" AND isSent = False',
};

const QUICK_FILTER_CONDITIONS: Record<string, () => string> = {
  workingOnly:    () => 'isRequestTemplate = False AND isRequestQuote = False',
  activePipeline: () => 'isLost = False AND isArchive = False AND isAccepted = False AND invoicePostStatus != "Posted"',
  expiryRisk:     () => {
    const today = new Date().toISOString().split('T')[0];
    return `expirationDate < [${today}] AND isAccepted = False AND isLost = False AND isArchive = False`;
  },
};

/**
 * Builds the extra CPQ conditions string from the synthetic status filter and quick filters.
 * Returns empty string if neither is active (caller should skip adding to qs).
 */
export function buildExtraConditions(statusFilter: string, quickFilters: string[]): string {
  const parts: string[] = [];
  if (statusFilter && statusFilter !== 'all' && STATUS_CONDITIONS[statusFilter]) {
    parts.push(STATUS_CONDITIONS[statusFilter]);
  }
  for (const qf of quickFilters) {
    const fn = QUICK_FILTER_CONDITIONS[qf];
    if (fn) parts.push(fn());
  }
  return parts.join(' AND ');
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
    displayName: 'Quote Status',
    name: 'quoteStatusFilter',
    type: 'options',
    displayOptions: { show: { resource: ['quotes'], operation: ['getAll'] } },
    options: [
      { name: 'Accepted / Won',    value: 'acceptedWon' },
      { name: 'All',               value: 'all' },
      { name: 'Archived',          value: 'archived' },
      { name: 'Draft',             value: 'draft' },
      { name: 'Invoiced',          value: 'invoiced' },
      { name: 'Lost',              value: 'lost' },
      { name: 'Manager Approved',  value: 'managerApproved' },
      { name: 'Pending Approval',  value: 'pendingApproval' },
      { name: 'Sent',              value: 'sent' },
    ],
    default: 'all',
    description: 'Filter quotes to a single lifecycle status. Compiled server-side as CPQ conditions. "syntheticStatus" is always added to output items regardless of this setting.',
  },
  {
    displayName: 'Quick Filters',
    name: 'quickFilters',
    type: 'multiOptions',
    displayOptions: { show: { resource: ['quotes'], operation: ['getAll'] } },
    options: [
      {
        name: 'Working Quotes Only',
        value: 'workingOnly',
        description: 'Excludes request templates and request quotes (isRequestTemplate = false AND isRequestQuote = false)',
      },
      {
        name: 'Active Pipeline Only',
        value: 'activePipeline',
        description: 'Excludes lost, archived, accepted, and invoiced quotes',
      },
      {
        name: 'Expiry Risk',
        value: 'expiryRisk',
        description: 'Only quotes past their expiration date that are still open (not accepted, lost, or archived)',
      },
    ],
    default: ['workingOnly'],
    description: 'Pre-built filters compiled server-side as CPQ conditions. Can be combined. "Working Quotes Only" is on by default.',
  },
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
    description: 'Fields to update on the quote. For boolean fields use "true" or "false". For date fields use ISO format (YYYY-MM-DD).',
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
              { name: 'Is Lost', value: 'isLost' },
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
              { name: 'Quote Status', value: 'quoteStatus' },
              { name: 'Quote Total', value: 'quoteTotal' },
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
    const quoteStatusFilter = this.getNodeParameter('quoteStatusFilter', i, 'all') as string;
    const quickFilters = this.getNodeParameter('quickFilters', i, ['workingOnly']) as string[];

    const extra = buildExtraConditions(quoteStatusFilter, quickFilters);
    const conditions = appendConditions(baseConditions ?? '', extra);

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

    for (const entry of results) {
      returnData.push({ json: { ...entry, syntheticStatus: computeSyntheticStatus(entry) } });
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
