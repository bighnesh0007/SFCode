`SfcRegionTagger.regionFor(String country)` maps a billing country to a sales region.
It works for the countries it knows, but crashes with a `NullPointerException`
for anything else, and it's case-sensitive.

Intended behaviour:

| Input | Result |
|---|---|
| `India`, `india`, ` INDIA ` | `APAC` |
| `Germany`, `France` (any case) | `EMEA` |
| `United States`, `Canada` (any case) | `AMER` |
| any other country, blank, or `null` | `Other` |

**Find and fix the bugs.**
