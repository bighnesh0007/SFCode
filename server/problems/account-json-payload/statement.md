A partner system exchanges accounts as JSON in this shape:

```json
[{"name": "Acme", "industry": "Technology", "employees": 120}]
```

Write `SfcAccountPayload` with two methods:

```apex
public static String toJson(List<Account> accounts)
public static List<Account> fromJson(String body)
```

- `toJson` maps `Name` → `name`, `Industry` → `industry`,
  `NumberOfEmployees` → `employees`, in the same order as the list. Empty or
  `null` input gives `[]`.
- `fromJson` turns the same shape back into (unsaved) Accounts. A missing
  `employees` leaves `NumberOfEmployees` null. Blank input gives an empty list.

Use a small wrapper class and `JSON.serialize` / `JSON.deserialize`, not string
concatenation.
