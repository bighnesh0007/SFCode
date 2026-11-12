This trigger copies each new Contact's **Account name** into the contact's
`Description`. It works when you create one contact in the UI — but a data load
of 200 contacts fails with:

> System.LimitException: Too many SOQL queries: 101

**Fix the trigger** so it behaves the same but survives inserting **200 contacts
in one DML statement**. Contacts with no account keep their `Description`
unchanged.
