@isTest
private class SfcInvoiceServiceTest {
    private class Mock implements HttpCalloutMock {
        List<Integer> statuses;
        List<String> bodies;
        List<HttpRequest> seen = new List<HttpRequest>();
        Mock(List<Integer> statuses, List<String> bodies) {
            this.statuses = statuses;
            this.bodies = bodies;
        }
        public HttpResponse respond(HttpRequest req) {
            seen.add(req);
            Integer i = Math.min(seen.size() - 1, statuses.size() - 1);
            HttpResponse res = new HttpResponse();
            res.setStatusCode(statuses[i]);
            res.setBody(bodies[i]);
            return res;
        }
    }

    static Opportunity deal() {
        Opportunity o = new Opportunity(Name = 'Deal', StageName = 'Closed Won', CloseDate = Date.today());
        insert o;
        return o;
    }

    @isTest
    static void issuesTheInvoice() {
        Opportunity o = deal();
        Mock m = new Mock(new List<Integer>{ 200 }, new List<String>{ '{"invoice": "INV-123"}' });
        Test.setMock(HttpCalloutMock.class, m);
        Test.startTest();
        SfcInvoiceService.issue(o.Id);
        Test.stopTest();
        System.assertEquals('Invoice INV-123', [SELECT NextStep FROM Opportunity WHERE Id = :o.Id].NextStep, 'Store the invoice number. Does it still fail with "uncommitted work pending"? Call out before any DML');
        System.assertEquals(1, [SELECT COUNT() FROM Task WHERE WhatId = :o.Id AND Subject = 'Invoice requested'], 'The Task is still logged');
        System.assertEquals('POST', m.seen[0].getMethod());
    }

    @isTest
    static void failureSavesNothing() {
        Opportunity o = deal();
        Test.setMock(HttpCalloutMock.class, new Mock(new List<Integer>{ 500 }, new List<String>{ 'boom' }));
        Test.startTest();
        try {
            SfcInvoiceService.issue(o.Id);
            System.assert(false, 'A 500 should throw InvoiceException');
        } catch (SfcInvoiceService.InvoiceException e) {
            System.assert(e.getMessage().contains('500'));
        }
        Test.stopTest();
        System.assertEquals(0, [SELECT COUNT() FROM Task WHERE WhatId = :o.Id], 'Nothing is saved when billing fails');
        System.assertEquals(null, [SELECT NextStep FROM Opportunity WHERE Id = :o.Id].NextStep);
    }
}
