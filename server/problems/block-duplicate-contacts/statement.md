Write a **before insert** trigger `SfcContactDedupe` on **Contact** that refuses
contacts whose `Email` is already taken.

A new contact is a duplicate when its email matches, **ignoring capitalisation**:

1. an **existing** contact's email, or
2. the email of an **earlier contact in the same insert**. The first one is
   kept and later ones are refused.

Refuse a duplicate with `addError('A contact with this email already exists.')`
on that record. Contacts with no email are never duplicates.

It must work when 200 contacts are inserted at once, using **one** query at most.
The hidden tests insert with `Database.insert(records, false)` so the valid rows
still save.
