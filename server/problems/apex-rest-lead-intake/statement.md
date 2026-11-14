A website posts sign-ups to Salesforce. Build a custom REST endpoint:

```apex
@RestResource(urlMapping='/sfc/leads')
global with sharing class SfcLeadApi {
    @HttpPost
    global static Result intake(String email, String lastName, String company) { ... }
}
```

with an inner `global class Result { global Id id; global Boolean created; global String error; }`.

- **Match on email** so retries never create duplicates: if a Lead with that
  `Email` exists, update its `LastName` and `Company` and return
  `created = false` with status **200**.
- Otherwise insert a new Lead and return `created = true` with status **201**.
- If `email` is blank, don't save anything: return status **400** with
  `error` = **email is required**.
- A missing `company` is saved as **Unknown** (Company is required on Lead).

Set the status code on `RestContext.response.statusCode`.
