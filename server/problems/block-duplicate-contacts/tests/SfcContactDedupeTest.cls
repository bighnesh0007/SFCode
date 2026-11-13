@isTest
private class SfcContactDedupeTest {
    static Database.SaveResult[] save(List<Contact> contacts) {
        return Database.insert(contacts, false);
    }

    @isTest
    static void refusesExistingEmailInAnyCase() {
        insert new Contact(LastName = 'Original', Email = 'ada@example.com');
        Database.SaveResult[] r = save(new List<Contact>{ new Contact(LastName = 'Copy', Email = 'ADA@Example.com') });
        System.assert(!r[0].isSuccess(), 'An email that exists in another case should be refused');
        System.assertEquals('A contact with this email already exists.', r[0].getErrors()[0].getMessage());
    }

    @isTest
    static void keepsFirstOfABatchRefusesTheRest() {
        Database.SaveResult[] r = save(new List<Contact>{
            new Contact(LastName = 'One', Email = 'team@example.com'),
            new Contact(LastName = 'Two', Email = 'Team@Example.com'),
            new Contact(LastName = 'Three', Email = 'other@example.com')
        });
        System.assert(r[0].isSuccess(), 'The first contact with an email is kept');
        System.assert(!r[1].isSuccess(), 'A later contact in the same insert with the same email is refused');
        System.assert(r[2].isSuccess(), 'A different email is fine');
    }

    @isTest
    static void noEmailIsNeverADuplicate() {
        Database.SaveResult[] r = save(new List<Contact>{ new Contact(LastName = 'A'), new Contact(LastName = 'B') });
        System.assert(r[0].isSuccess() && r[1].isSuccess(), 'Contacts without email are never duplicates');
    }

    @isTest
    static void bulkWithOneQuery() {
        insert new Contact(LastName = 'Existing', Email = 'user0@example.com');
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 200; i++) {
            contacts.add(new Contact(LastName = 'Bulk ' + i, Email = 'user' + Math.mod(i, 150) + '@example.com'));
        }
        Test.startTest();
        Database.SaveResult[] r = save(contacts);
        Integer queries = Limits.getQueries();
        Test.stopTest();
        Integer ok = 0;
        for (Database.SaveResult s : r) {
            if (s.isSuccess()) ok++;
        }
        System.assertEquals(149, ok, '150 distinct emails, one of which already exists: 149 should save');
        System.assert(queries <= 1, 'Use at most one query for the whole insert (used ' + queries + ')');
    }
}
