public with sharing class SfcRatesClient {
    public class RatesException extends Exception {}

    public static Decimal rate(String fromCurrency, String toCurrency) {
        HttpResponse res = send(fromCurrency, toCurrency);
        if (res.getStatusCode() == 429 || res.getStatusCode() == 503) res = send(fromCurrency, toCurrency);
        if (res.getStatusCode() != 200) throw new RatesException('Rates API returned ' + res.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (Decimal) body.get('rate');
    }

    private static HttpResponse send(String fromCurrency, String toCurrency) {
        HttpRequest req = new HttpRequest();
        req.setMethod('GET');
        req.setEndpoint('https://api.example.com/rates?from=' + fromCurrency + '&to=' + toCurrency);
        return new Http().send(req);
    }
}
