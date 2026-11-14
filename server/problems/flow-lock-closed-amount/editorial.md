## Build it

1. Record-Triggered Flow on **Opportunity**, **A record is updated**, optimized for **Fast Field Updates**.
2. Entry conditions are on the new values, so add a **Decision** (or a formula condition) on the prior values:
   - `{!$Record__Prior.IsClosed}` **Equals** `true`
   - **AND** `{!$Record.Amount}` **Not Equal To** `{!$Record__Prior.Amount}`
3. On that outcome, add a **Custom Error** element with the message **Closed deals can't change amount.** (shown as a window on the page).
4. Save as **SFC_Lock_Closed_Amount** and **Activate**.

## The key idea

`$Record__Prior` holds the values from before this save. Checking the *prior* `IsClosed` is what lets the save that closes a deal set its amount, while every later change is blocked. The Custom Error element turns a flow into a validation with logic a formula can't express easily.
