# QuoteCustomers: Update / Replace / Delete

- Resource: `Quote Customers`

## List customers for a quote
- Operation: `Get Many`
- Quote ID: `<quoteId>`

## Update (PATCH)
- Operation: `Update`
- Quote ID: `<quoteId>`
- Customer ID: `<customerId>`
- Patch Operations (JSON):

```
[{ "op": "replace", "path": "/emailAddress", "value": "new@example.com" }]
```

## Replace (PUT)
- Operation: `Replace`
- Quote ID: `<quoteId>`
- Customer ID: `<customerId>`
- Customer (JSON): full `CustomerView` model

## Delete
- Operation: `Delete`
- Quote ID: `<quoteId>`
- Customer ID: `<customerId>`

