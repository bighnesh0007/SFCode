Use a **Decision** element to rate accounts by size. Build a record-triggered
flow **in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Rate_By_Revenue`** |
| Object | Account |
| Trigger | A record is **created** |
| Optimize for | **Fast Field Updates** |

Set `Rating` from `AnnualRevenue`:

| AnnualRevenue | Rating |
|---|---|
| 10,000,000 or more | **Hot** |
| 1,000,000 up to 9,999,999 | **Warm** |
| below 1,000,000, **or blank** | **Cold** |

*Hint:* order matters. Check the largest tier first, and let the default
outcome handle everything else.
