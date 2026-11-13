public with sharing class SfcWeatherClient {
    public class WeatherException extends Exception {}

    public static Decimal temperatureFor(String city) {
        if (String.isBlank(city)) {
            throw new WeatherException('A city is required.');
        }
        HttpRequest req = new HttpRequest();
        req.setMethod('GET');
        req.setEndpoint('https://api.example.com/weather?city=' + EncodingUtil.urlEncode(city, 'UTF-8'));
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            throw new WeatherException('Weather API returned ' + res.getStatusCode());
        }
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (Decimal) body.get('tempC');
    }
}
