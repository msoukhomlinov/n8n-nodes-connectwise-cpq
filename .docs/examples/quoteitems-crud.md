# QuoteItems: Create / Update / Delete

Create a quote item, update via JSON Patch, then delete it.

- Resource: `Quote Items`

## Create
- Operation: `Create`
- Item (JSON), example:

```
{
  "quote": { "id": "<quoteId>" },
  "description": "Line item",
  "quantity": 1,
  "unitPrice": 100
}
```

## Update (PATCH)
- Operation: `Update`
- Item ID: `<createdItemId>`
- Patch Operations (JSON):

```
[{ "op": "replace", "path": "/quantity", "value": 2 }]
```

## Delete
- Operation: `Delete`
- Item ID: `<createdItemId>`

