Support reports bucket open cases by age. `SfcCaseAgeing.bucket(Date opened, Date today)`
must return:

| Age in days (`opened.daysBetween(today)`) | Bucket |
|---|---|
| 0 – 7 | `New` |
| 8 – 30 | `Ageing` |
| 31 or more | `Stale` |
| `opened` after `today`, or either date `null` | `Invalid` |

The report is putting some cases in the wrong bucket. **Find and fix the bugs.**
