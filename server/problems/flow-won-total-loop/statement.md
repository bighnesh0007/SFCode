Use a **Loop** to process a collection. Build an **autolaunched flow** in your
connected org:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Won_Total`** |
| Type | **Autolaunched Flow (No Trigger)** |

Variables (names must match exactly):

| Variable | Type | Available for… |
|---|---|---|
| `opportunities` | Record collection of **Opportunity** | **input** |
| `wonTotal` | Currency, default **0** | **output** |

Loop over `opportunities` and **add** each `Amount` to `wonTotal`, but only for
opportunities whose `StageName` is **Closed Won**. An empty collection gives 0.

*Hint:* inside the loop, a Decision picks the won ones, and an Assignment with
the **Add** operator accumulates. Both paths must lead back to the loop.
