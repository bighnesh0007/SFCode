## What was wrong

1. `REGIONS.get(country)` returns **null** for an unknown key, and `region.toUpperCase()` on null throws `NullPointerException`.
2. Map keys are **case-sensitive**: `'india'` doesn't find `'India'`.
3. A null input reaches `get` and the same crash follows.

## The fix

Store the keys lower-case, normalise the input with `trim().toLowerCase()`, and treat a missing entry as `'Other'`. `containsKey` before `get` works too; checking the result for null does the same job in one lookup.

## Solution

```apex
public with sharing class SfcRegionTagger {
    private static final Map<String, String> REGIONS = new Map<String, String>{
        'india' => 'APAC',
        'germany' => 'EMEA',
        'france' => 'EMEA',
        'united states' => 'AMER',
        'canada' => 'AMER'
    };

    public static String regionFor(String country) {
        if (String.isBlank(country)) {
            return 'Other';
        }
        String region = REGIONS.get(country.trim().toLowerCase());
        return region == null ? 'Other' : region;
    }
}
```
