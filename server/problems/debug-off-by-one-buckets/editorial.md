## What was wrong

The buckets used `<` where the statement said "up to and including", so a case exactly 7 or 30 days old landed in the wrong bucket. That's a classic off-by-one, and only boundary tests catch it.

## The fix

Compute the age once with `opened.daysBetween(today)`, then compare with `<=` at each documented boundary. Reject impossible input (null dates, or a case opened in the future) before doing any maths.

## Lesson

When a requirement names a number, test exactly that number, plus one either side.

## Solution

**SfcCaseAgeing.cls**

```apex
public with sharing class SfcCaseAgeing {
    public static String bucket(Date opened, Date today) {
        if (opened == null || today == null || opened > today) {
            return 'Invalid';
        }
        Integer age = opened.daysBetween(today);
        if (age <= 7) {
            return 'New';
        } else if (age <= 30) {
            return 'Ageing';
        }
        return 'Stale';
    }
}
```
