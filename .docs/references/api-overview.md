# REST

**Last updated:** Aug 30, 2024

## Authentication

Authentication to the CPQ APIs is similar to the Manage APIs using Basic Authorisation. Each request needs to pass an Authorisation header that is a Base64 encoded username:password, where username is a combination of AccessKey+SellAPIUsername and password is password. (Full Authorisation header would be "accesskey+username:password"). Your accesskey can be found by logging into CPQ and checking the parameters listed in the URL. The user must be an API user.

**Update:** Starting with CPQ Release 2022.2, API keys will be used for authentication (CPQ: Settings > Organisation Settings > API Keys > Click "Add" button). API key usage is similar to the above username/password authentication though with a Base64 encoded string with the convention: "accesskey+PublicKey:PrivateKey"

### C# Sample

```csharp
string auth = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(accessKey + "+" + SellAPIUsername + ":" + sellPassword));
client.Headers.Add("Authorization:basic " + auth);
```

## Conditions

| Data Type | Format | Example |
|-----------|--------|---------|
| Strings | Must be surrounded by quotes | `accountName = "This is my string"` |
| Integers | No formatting required | `cost = 123` |
| Boolean | No formatting required but must be True or False | `approvalOnChange = True` |
| Datetimes | Must be surrounded by square brackets | `modifyDate > [2016-08-20]` |

### Operators
`<`, `<=`, `=`, `!=`, `>`, `>=`, `contains`, `in`, `not`

**Example:** `accountName Not Contains "Low Priority"`

### Logic Operators
Supported operators include:
- AND
- OR

**Examples:**
- `accountName="xyzCompany" and quote/id="xyz"`
- `accountName="xyzCompany" or firstName="Smith"`

## ConnectWiseSellService

**Base URL:** `sellapi.quosalsell.com`

**API Documentation:** https://developer.connectwise.com/@api/deki/files/757/SellAPI.json?origin=mt-web

**Version:** 1.0

**Schemes:** HTTPS

### Available Endpoints

- QuoteCustomers
- QuoteItems  
- Quotes
- QuoteTabs
- QuoteTerms
- RecurringRevenue
- TaxCode
- Templates
- User
- Models

---

*© Copyright 2024 Developer Network Powered by CXone Expert ®*  
*© 2024 ConnectWise. All Rights Reserved.*