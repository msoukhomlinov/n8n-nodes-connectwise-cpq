# n8n-nodes-connectwise-cpq

[![version](https://img.shields.io/npm/v/n8n-nodes-connectwise-cpq.svg)](https://www.npmjs.org/package/n8n-nodes-connectwise-cpq)
[![downloads](https://img.shields.io/npm/dt/n8n-nodes-connectwise-cpq.svg)](https://www.npmjs.org/package/n8n-nodes-connectwise-cpq)

Community node for ConnectWise CPQ (Sell) REST API, aligned with n8n v1+ node standard.

## Requirements

- ConnectWise CPQ 2022.2 or later (API key–based authentication only)
- API keys (Public/Private) and your Access Key

## Install (n8n UI)

1. Open n8n → Settings (cogwheel)
2. Community Nodes → Install
3. Enter `n8n-nodes-connectwise-cpq`
4. Accept the risk prompt → Install

## Credentials

Create new credentials: "ConnectWise CPQ (Sell) API" and set:

- Access Key: from CPQ UI URL when logged in
- Public Key: generated in CPQ (Settings → Organisation Settings → API Keys)
- Private Key: generated in CPQ (shown once)
- Base URL: `https://sellapi.quosalsell.com` (default; override only if instructed by ConnectWise)

Authentication header is built as Basic with username `accessKey+publicKey` and password `privateKey`.

Headers automatically set:

- `Content-Type: application/json; version=1.0`
- `Accept: application/json`

## Supported resources and operations (Phase 1)

- Quotes: get, getAll, delete, copy
- QuoteItems: get, getAll, create, update (PATCH), delete
- QuoteCustomers: getAll (by quote), update (PATCH), replace (PUT), delete
- QuoteTabs: getAll, getItemsByTab
- QuoteTerms: getAll (by quote), create, update (PATCH), delete
- RecurringRevenue: getAll
- TaxCodes: getAll
- Templates: getAll
- User: getAll, update (PATCH)

## Parameters

- Filters: `conditions`, `includeFields`, `showAllVersions` (where supported)
- Pagination: `returnAll`, `limit`, `pageSize` (max 1000)

When `returnAll` is true, the node paginates using `page` and `pageSize` until fewer than requested results are returned.

## Error handling

- `continueOnFail`: errors are collected per item and execution continues
- Retries: 429/5xx responses retried up to 3 times with exponential backoff

## Examples

See `.docs/examples/` for usage guides:

- Quotes: list with filters; get by id
- QuoteItems: create, update (PATCH), delete
- QuoteCustomers: update (PATCH) and replace (PUT)

## Notes

- Only CPQ 2022.2+ is supported. Legacy username/password auth is not supported.
- This node consumes the official Swagger: see `references/SellAPI.json`.
