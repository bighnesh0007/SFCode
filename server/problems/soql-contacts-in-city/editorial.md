## Approach

Child-to-parent relationships use **dot notation** in SELECT and WHERE alike, up to five levels deep. No join is needed: `Account.BillingCity` follows the contact's `AccountId` lookup.

Contacts with no account simply don't match, because their `Account.BillingCity` is null.

## Solution

**query.soql**

```sql
SELECT Id, LastName, Account.Name FROM Contact WHERE Account.BillingCity = 'Pune'
```
