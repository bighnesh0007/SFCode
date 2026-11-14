## Approach

Not every failure deserves a retry:

- **429 Too Many Requests** and **503 Service Unavailable** are temporary; a retry may succeed.
- **4xx errors** like 400 or 404 mean the request itself is wrong; retrying sends the same bad request again.

Retry a bounded number of times (here once), so a broken API can't make the transaction spin through its callout limit. In production you'd usually also back off, often by retrying later from a Queueable.

## Solution

```apex
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
```
