## What was wrong

Apex doesn't treat `null` as zero: `amount * percent` with either one null throws `System.NullPointerException`. The original code assumed both were always set.

## The fix

1. A null `amount` returns `0` straight away.
2. A null `percent` is treated as `0`, and anything outside 0-100 is clamped, so a 150% discount can't make the price negative.
3. Money is rounded to 2 places with `HALF_UP`, which is what people expect from a till.

## Lesson

At every public method's boundary, ask what happens if each argument is null.

## Solution

**SfcDiscount.cls**

```apex
public with sharing class SfcDiscount {
    public static Decimal discounted(Decimal amount, Decimal percent) {
        if (amount == null) {
            return 0;
        }
        Decimal p = percent == null ? 0 : Math.min(Math.max(percent, 0), 100);
        return (amount - amount * p / 100).setScale(2, RoundingMode.HALF_UP);
    }
}
```
