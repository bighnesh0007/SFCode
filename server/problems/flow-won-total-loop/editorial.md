## Build it

1. **Autolaunched Flow (No Trigger).**
2. Variables:
   - `opportunities`: Record, **Allow multiple values (collection)**, Object Opportunity, **Available for input**.
   - `wonTotal`: Currency, default `0`, **Available for output**.
3. **Loop** over `{!opportunities}`.
4. Inside: **Decision** *Is won?* with `{!Loop_Opp.StageName}` Equals `Closed Won`.
5. Won path: **Assignment** `{!wonTotal}` **Add** `{!Loop_Opp.Amount}`.
6. Connect the Assignment **and** the Decision's default path back to the Loop. Connect **After Last Item** to the end.
7. Save as **SFC_Won_Total** and **Activate**.

## Common mistakes

- Forgetting the default path back to the loop: the flow stops at the first lost deal.
- Using **Equals** instead of **Add** in the Assignment: you get the last amount, not the sum.
- No default value of 0: an empty collection returns null.
