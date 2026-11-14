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
