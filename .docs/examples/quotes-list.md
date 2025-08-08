# Quotes: List

This example lists quotes with filters and pagination.

1. Add the node `ConnectWise CPQ (Sell)`
2. Resource: `Quotes`
3. Operation: `Get Many`
4. Optional:
   - Conditions: `accountName = "Acme"`
   - Include Fields: `id, name, status`
   - Return All: true (or set Limit and Page Size)

Output: Array of `QuoteView` objects.


