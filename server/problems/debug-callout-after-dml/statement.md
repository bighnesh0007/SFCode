`SfcInvoiceService.issue(Id opportunityId)` logs a Task on the opportunity,
asks the billing API for an invoice number, and stores it in the opportunity's
`NextStep` as **Invoice INV-123**.

Every call fails with:

```
System.CalloutException: You have uncommitted work pending.
Please commit or rollback before calling out
```

Fix it so the invoice is issued, the Task is still logged (Subject **Invoice
requested**), and `NextStep` holds the invoice number. If the billing API
doesn't return 200, throw `SfcInvoiceService.InvoiceException` and save
**nothing** (no Task, no NextStep change).
