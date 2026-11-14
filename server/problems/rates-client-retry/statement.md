Write `SfcRatesClient` with:

```apex
public static Decimal rate(String fromCurrency, String toCurrency)
public class RatesException extends Exception {}
```

- `GET https://api.example.com/rates?from=USD&to=INR` (the two codes in that order).
- A **200** response looks like `{"rate": 83.12}`: return the rate.
- **Temporary failures** (status **429** or **503**): retry **once**. If the
  retry succeeds, return its rate; if it fails again, throw `RatesException`
  with the status code in the message.
- **Other errors** (any other non-200 status, such as 400 or 404): throw
  `RatesException` right away, **without** retrying.
- Never make more than **two** callouts per call.
