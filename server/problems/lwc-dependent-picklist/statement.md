Build a `c-location-picker` with a city list that depends on the chosen country.

- **`@api countries`**: an array of `{ name, cities: [...] }` (default `[]`).
- `<select class="country">` with a first option `<option value="">Choose a
  country</option>`, then one option per country (value and label = its name).
- `<select class="city">` with a first option `<option value="">Choose a
  city</option>`, then the chosen country's cities. It is **`disabled`** until a
  country is chosen.
- Changing the country resets the city to none.
- When a city is chosen, dispatch a **`select`** event with
  `detail` `{ country, city }`.
