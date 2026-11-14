An import created duplicate accounts. Write `SfcAccountMerger` with:

```apex
public static Integer mergeDuplicates(List<Account> accounts)
```

- Accounts are duplicates when their `Name` matches **ignoring case and
  surrounding spaces** (`Acme`, ` ACME ` and `acme` are one company).
- In each group, keep the **oldest** account (earliest `CreatedDate`; if equal,
  the smallest Id) and **merge** the others into it with `Database.merge`, so
  their contacts and opportunities move to the survivor.
- `Database.merge` takes a master plus **at most two** duplicates per call, so a
  group of five needs two calls.
- Return how many accounts were merged away. Groups of one are left alone.
- Query what you need yourself: the list may only contain Ids and Names.
