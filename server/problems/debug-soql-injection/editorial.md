## What was wrong

The query was built by gluing user input into a string. Input like `x' OR Name != '` closes the quoted value and adds its own condition, so the query becomes `WHERE Industry = 'x' OR Name != ''`, which matches every account. That's **SOQL injection**.

## The fix

Use a **bind variable**. `WHERE Industry = :industry` sends the value separately from the query text, so nothing in it can change the query's structure. Binds work in static SOQL, and in dynamic SOQL too: `Database.query` resolves binds from local variables, and `Database.queryWithBinds` takes a map.

If you truly must build a string, `String.escapeSingleQuotes(input)` escapes quotes. Binds are simpler and safer.

## Solution

```apex
public with sharing class SfcAccountSearch {
    public static List<String> byIndustry(String industry) {
        List<String> names = new List<String>();
        if (String.isBlank(industry)) {
            return names;
        }
        for (Account a : [SELECT Name FROM Account WHERE Industry = :industry ORDER BY Name]) {
            names.add(a.Name);
        }
        return names;
    }
}
```
