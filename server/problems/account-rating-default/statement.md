Sales wants every new **Technology** account flagged as a hot lead.

Write the trigger `SfcAccountRating` on **Account** so that, when accounts are
**inserted**:

- if `Industry` is `Technology` **and** `Rating` is blank, set `Rating` to `Hot`;
- never overwrite a `Rating` the user already chose;
- leave every other account untouched.

The trigger must handle **200 records in one insert** — no SOQL or DML inside a loop.

### Example

| Industry | Rating (in) | Rating (saved) |
|---|---|---|
| Technology | *(blank)* | Hot |
| Technology | Cold | Cold |
| Banking | *(blank)* | *(blank)* |
