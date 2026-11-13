Write `SfcWeatherClient` with one method:

```apex
public static Decimal temperatureFor(String city)
```

It calls a weather API and returns the temperature in °C.

**Request**

- Method `GET`
- Endpoint `https://api.example.com/weather?city=` followed by the city,
  **URL-encoded** with `EncodingUtil.urlEncode(city, 'UTF-8')`.
  `São Paulo` becomes `S%C3%A3o+Paulo`.

**Response**

A `200` response has a JSON body such as `{"city": "Pune", "tempC": 31.5}`. Return
`tempC` as a `Decimal`.

**Errors**

For any status other than 200, throw `SfcWeatherClient.WeatherException` (an inner class
you declare: `public class WeatherException extends Exception {}`) whose message
contains the status code. A blank `city` throws the same exception **without** making a callout.

The hidden tests use an `HttpCalloutMock`, so no Remote Site Setting is needed.
