@isTest
private class SfcWeatherClientTest {
    private class Mock implements HttpCalloutMock {
        Integer status;
        String body;
        HttpRequest seen;
        Mock(Integer status, String body) {
            this.status = status;
            this.body = body;
        }
        public HttpResponse respond(HttpRequest req) {
            seen = req;
            HttpResponse res = new HttpResponse();
            res.setStatusCode(status);
            res.setBody(body);
            return res;
        }
    }

    @isTest
    static void returnsTemperature() {
        Mock m = new Mock(200, '{"city": "Pune", "tempC": 31.5}');
        Test.setMock(HttpCalloutMock.class, m);
        System.assertEquals(31.5, SfcWeatherClient.temperatureFor('Pune'));
        System.assertEquals('GET', m.seen.getMethod(), 'Use GET');
        System.assertEquals('https://api.example.com/weather?city=Pune', m.seen.getEndpoint());
    }

    @isTest
    static void encodesTheCity() {
        Mock m = new Mock(200, '{"tempC": 24}');
        Test.setMock(HttpCalloutMock.class, m);
        System.assertEquals(24, SfcWeatherClient.temperatureFor('São Paulo'));
        System.assertEquals('https://api.example.com/weather?city=S%C3%A3o+Paulo', m.seen.getEndpoint(), 'URL-encode the city with EncodingUtil.urlEncode');
    }

    @isTest
    static void throwsOnErrorStatus() {
        Test.setMock(HttpCalloutMock.class, new Mock(503, 'down'));
        try {
            SfcWeatherClient.temperatureFor('Pune');
            System.assert(false, 'A 503 should throw WeatherException');
        } catch (SfcWeatherClient.WeatherException e) {
            System.assert(e.getMessage().contains('503'), 'The message should include the status code');
        }
    }

    @isTest
    static void blankCityThrowsWithoutCallout() {
        Mock m = new Mock(200, '{"tempC": 1}');
        Test.setMock(HttpCalloutMock.class, m);
        try {
            SfcWeatherClient.temperatureFor('  ');
            System.assert(false, 'A blank city should throw');
        } catch (SfcWeatherClient.WeatherException e) {
            System.assertEquals(null, m.seen, 'No callout should be made for a blank city');
        }
    }
}
