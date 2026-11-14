@isTest
private class SfcErpSyncTest {
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

    static List<Opportunity> deals(Integer n) {
        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < n; i++) opps.add(new Opportunity(Name = 'Deal ' + i, StageName = 'Negotiation/Review', Amount = 1000 + i, CloseDate = Date.today()));
        insert opps;
        return opps;
    }

    static Integer queuedJobs() {
        return [SELECT COUNT() FROM AsyncApexJob WHERE JobType = 'Queueable' AND ApexClass.Name = 'SfcErpSyncJob'];
    }

    @isTest
    static void sendsWonDealsAndMarksThem() {
        Mock m = new Mock(new List<Integer>{ 201 }, new List<String>{ '{"ok":true}' });
        Test.setMock(HttpCalloutMock.class, m);
        List<Opportunity> opps = deals(2);
        for (Opportunity o : opps) o.StageName = 'Closed Won';
        Test.startTest();
        update opps;
        Test.stopTest();
        System.assertEquals(1, m.seen.size(), 'One POST for all the won deals');
        HttpRequest req = m.seen[0];
        System.assertEquals('POST', req.getMethod());
        System.assertEquals('https://erp.example.com/orders', req.getEndpoint());
        System.assertEquals('application/json', req.getHeader('Content-Type'));
        List<Object> body = (List<Object>) JSON.deserializeUntyped(req.getBody());
        System.assertEquals(2, body.size(), 'The body is a JSON array with one order per deal');
        Map<String, Object> first = (Map<String, Object>) body[0];
        System.assert(first.containsKey('id') && first.containsKey('name') && first.containsKey('amount'), 'Each order has id, name and amount');
        System.assertEquals(2, [SELECT COUNT() FROM Opportunity WHERE NextStep = 'Sent to ERP'], 'A 201 marks the deals as sent');
    }

    @isTest
    static void marksFailures() {
        Test.setMock(HttpCalloutMock.class, new Mock(new List<Integer>{ 500 }, new List<String>{ 'boom' }));
        List<Opportunity> opps = deals(1);
        opps[0].StageName = 'Closed Won';
        Test.startTest();
        update opps;
        Test.stopTest();
        System.assertEquals('ERP sync failed', [SELECT NextStep FROM Opportunity WHERE Id = :opps[0].Id].NextStep);
    }

    @isTest
    static void onlyDealsThatJustBecameWon() {
        Mock m = new Mock(new List<Integer>{ 201 }, new List<String>{ '{}' });
        Test.setMock(HttpCalloutMock.class, m);
        List<Opportunity> opps = deals(1);
        opps[0].Description = 'Not won yet';
        Test.startTest();
        update opps;
        Test.stopTest();
        System.assertEquals(0, queuedJobs(), 'No job when no deal became Closed Won');
        System.assertEquals(0, m.seen.size());
    }

    @isTest
    static void oneJobForABulkUpdate() {
        Mock m = new Mock(new List<Integer>{ 201 }, new List<String>{ '{}' });
        Test.setMock(HttpCalloutMock.class, m);
        List<Opportunity> opps = deals(120);
        for (Opportunity o : opps) o.StageName = 'Closed Won';
        Test.startTest();
        update opps;
        Test.stopTest();
        System.assertEquals(1, queuedJobs(), 'Enqueue one job for all 120 deals, not one per deal (50 jobs is the limit)');
        System.assertEquals(120, ((List<Object>) JSON.deserializeUntyped(m.seen[0].getBody())).size());
        System.assertEquals(120, [SELECT COUNT() FROM Opportunity WHERE NextStep = 'Sent to ERP']);
    }
}
