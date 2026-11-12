Not every flow is triggered by a record. Build an **autolaunched flow** (no
trigger) that other automation, here Apex, can call.

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Shipping_Cost`** |
| Type | **Autolaunched Flow (No Trigger)** |

Variables (names must match exactly):

| Variable | Type | Available for… |
|---|---|---|
| `weightKg` | Number (2 decimal places) | **input** |
| `cost` | Currency (2 decimal places) | **output** |

Set `cost` to **5 + 2 × weightKg**, but **never more than 50**.

| weightKg | cost |
|---|---|
| 0 | 5 |
| 3 | 11 |
| 22.5 | 50 |
| 40 | 50 |

**Activate** the flow, then click **Check my flow**. Hidden tests call it with
`Flow.Interview.createInterview('SFC_Shipping_Cost', …)` and read `cost`.
