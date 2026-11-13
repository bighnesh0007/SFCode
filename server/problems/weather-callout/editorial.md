## Approach

1. **Validate first.** A blank city throws before any request is built, so there's no wasted callout.
2. **Build the request.** `HttpRequest` with `GET` and the endpoint. `EncodingUtil.urlEncode` turns spaces into `+` and non-ASCII characters into `%XX` sequences, which keeps the URL valid.
3. **Check the status** before parsing. An error body is rarely the JSON you expect.
4. **Parse.** `JSON.deserializeUntyped` returns `Map<String, Object>`, and numbers come back as `Decimal`.

## Testing callouts

Apex tests can't make real callouts. `Test.setMock(HttpCalloutMock.class, mock)` makes `Http.send` call your mock's `respond` method instead. The hidden tests also record the request, to check the method and endpoint.

## Solution

```apex
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
```
