## Build it

1. Record-Triggered Flow on **Account**, **created**, **Fast Field Updates**.
2. Add a **Decision** with outcomes in this order:
   - **Hot:** `AnnualRevenue` Greater Than or Equal `10000000`
   - **Warm:** `AnnualRevenue` Greater Than or Equal `1000000`
   - **Default outcome**, renamed *Cold*.
3. On each path, an **Assignment**: `{!$Record.Rating}` Equals `Hot` / `Warm` / `Cold`.
4. Save as **SFC_Rate_By_Revenue** and **Activate**.

## Why order matters

10M is also over 1M. If Warm came first, every big account would be rated Warm. The default outcome also handles blank revenue for free, since a null value matches neither comparison.
