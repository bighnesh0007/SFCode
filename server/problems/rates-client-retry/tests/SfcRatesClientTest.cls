@isTest
private class SfcRatesClientTest {
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

    @isTest
    static void returnsTheRate() {
        Mock m = new Mock(new List<Integer>{ 200 }, new List<String>{ '{"rate": 83.12}' });
        Test.setMock(HttpCalloutMock.class, m);
        System.assertEquals(83.12, SfcRatesClient.rate('USD', 'INR'));
        System.assertEquals('GET', m.seen[0].getMethod());
        System.assertEquals('https://api.example.com/rates?from=USD&to=INR', m.seen[0].getEndpoint());
        System.assertEquals(1, m.seen.size(), 'One callout when it succeeds');
    }

    @isTest
    static void retriesOnceAfter429() {
        Mock m = new Mock(new List<Integer>{ 429, 200 }, new List<String>{ 'slow down', '{"rate": 0.92}' });
        Test.setMock(HttpCalloutMock.class, m);
        System.assertEquals(0.92, SfcRatesClient.rate('USD', 'EUR'), 'A 429 is temporary: the retry should succeed');
        System.assertEquals(2, m.seen.size());
    }

    @isTest
    static void givesUpAfterTwoTemporaryFailures() {
        Mock m = new Mock(new List<Integer>{ 503, 503, 200 }, new List<String>{ 'down', 'down', '{"rate": 1}' });
        Test.setMock(HttpCalloutMock.class, m);
        try {
            SfcRatesClient.rate('USD', 'GBP');
            System.assert(false, 'Two 503s in a row should throw RatesException');
        } catch (SfcRatesClient.RatesException e) {
            System.assert(e.getMessage().contains('503'), 'Include the status code in the message');
        }
        System.assertEquals(2, m.seen.size(), 'Retry once, never more than two callouts');
    }

    @isTest
    static void doesNotRetryPermanentErrors() {
        Mock m = new Mock(new List<Integer>{ 404, 200 }, new List<String>{ 'no such currency', '{"rate": 1}' });
        Test.setMock(HttpCalloutMock.class, m);
        try {
            SfcRatesClient.rate('USD', 'XXX');
            System.assert(false, 'A 404 should throw RatesException');
        } catch (SfcRatesClient.RatesException e) {
            System.assert(e.getMessage().contains('404'));
        }
        System.assertEquals(1, m.seen.size(), 'A 404 is permanent: retrying sends the same bad request');
    }
}
