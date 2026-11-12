`SfcDiscount.discounted(Decimal amount, Decimal percent)` should return the
amount after a percentage discount, **rounded to 2 decimal places**
(`RoundingMode.HALF_UP`). Users report crashes and odd results.

The intended rules:

| Input | Result |
|---|---|
| `amount` is `null` | `0` |
| `percent` is `null` | no discount (return `amount`, rounded) |
| `percent` below 0 | treat as 0 |
| `percent` above 100 | treat as 100 |

Example: `discounted(200, 15)` → `170.00`; `discounted(10, 33.333)` → `6.67`.

**Find and fix the bugs.**
