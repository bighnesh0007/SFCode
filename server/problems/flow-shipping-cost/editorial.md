## Build it

1. **New Flow → Autolaunched Flow (No Trigger).**
2. **New Resource → Variable** `weightKg`: Number, 2 decimals, **Available for input**.
3. **New Resource → Variable** `cost`: Currency, 2 decimals, **Available for output**.
4. **New Resource → Formula** `costFormula` (Currency): `MIN(50, 5 + 2 * {!weightKg})`.
5. One **Assignment**: `{!cost}` Equals `{!costFormula}`.
6. Save as **SFC_Shipping_Cost** and **Activate**.

## How Apex calls it

```apex
Flow.Interview i = Flow.Interview.createInterview('SFC_Shipping_Cost', new Map<String, Object>{ 'weightKg' => 3 });
i.start();
Decimal cost = (Decimal) i.getVariableValue('cost'); // 11
```

Input and output availability is what makes a variable visible to the caller. It's the most common reason this check fails.
