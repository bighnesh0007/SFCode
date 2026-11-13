`SfcAccountSearch.byIndustry(String industry)` returns the names of accounts in an
industry, sorted by name. A security review found that a crafted input returns
**every** account:

```apex
SfcAccountSearch.byIndustry('x\' OR Name != \'');   // returns all accounts!
```

**Fix it** so input is always treated as data, never as part of the query.

- Normal searches must keep working: `byIndustry('Technology')`.
- A blank or null industry returns an empty list.
- Keep the result sorted by `Name`.
