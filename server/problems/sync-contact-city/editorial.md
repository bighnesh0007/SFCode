## Approach

Queueable Apex is the modern way to run work asynchronously:

- It can take **non-primitive arguments** (here a `Set<Id>`) through its constructor. `@future` can't.
- `System.enqueueJob(new SfcContactCitySync(ids))` returns a job id you can monitor.
- It can chain another job from `execute`.

Inside `execute`: one query that pulls the parent's city via `Account.BillingCity`, a loop, and one `update`. That's bulk-safe however many accounts are passed.

In tests, wrap the enqueue in `Test.startTest()` / `Test.stopTest()`. The job runs at `stopTest`.

## Solution

**SfcContactCitySync.cls**

```apex
public with sharing class SfcContactCitySync implements Queueable {
    private final Set<Id> accountIds;

    public SfcContactCitySync(Set<Id> accountIds) {
        this.accountIds = accountIds;
    }

    public void execute(QueueableContext context) {
        List<Contact> contacts = [
            SELECT Id, Account.BillingCity FROM Contact WHERE AccountId IN :accountIds
        ];
        for (Contact c : contacts) {
            c.MailingCity = c.Account.BillingCity;
        }
        update contacts;
    }
}
```
