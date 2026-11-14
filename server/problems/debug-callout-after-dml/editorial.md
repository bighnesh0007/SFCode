## What's wrong

The method inserts the Task **before** calling out. A transaction with pending DML can't make a callout, because the external system could act on data that might still roll back.

## The fix

Call out **first**, check the response, **then** do all the DML:

```apex
public with sharing class SfcInvoiceService {
    public class InvoiceException extends Exception {}

    public static void issue(Id opportunityId) {
        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setEndpoint('https://billing.example.com/invoices');
        req.setBody(JSON.serialize(new Map<String, Object>{ 'opportunityId' => opportunityId }));
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) throw new InvoiceException('Billing API returned ' + res.getStatusCode());
        String invoice = (String) ((Map<String, Object>) JSON.deserializeUntyped(res.getBody())).get('invoice');

        insert new Task(WhatId = opportunityId, Subject = 'Invoice requested');
        update new Opportunity(Id = opportunityId, NextStep = 'Invoice ' + invoice);
    }
}
```

Doing the checks before any DML also gives the error case for free: nothing has been saved when the exception is thrown. When the DML truly must happen first, move the callout to a Queueable or `@future(callout=true)`, which runs in a separate transaction.
