@isTest
private class SfcContactIndexTest {
    // Valid-looking Account Ids; nothing is inserted.
    static final Id A1 = Id.valueOf('001000000000001AAA');
    static final Id A2 = Id.valueOf('001000000000002AAA');

    static List<Contact> sample() {
        return new List<Contact>{
            new Contact(LastName = 'Ann', AccountId = A1),
            new Contact(LastName = 'Cy', AccountId = A2),
            new Contact(LastName = 'Dee'),
            null,
            new Contact(LastName = 'Bob', AccountId = A1)
        };
    }

    @isTest
    static void groupsInInputOrder() {
        Map<Id, List<Contact>> groups = SfcContactIndex.byAccount(sample());
        System.assertNotEquals(null, groups, 'byAccount must return a map, not null');
        System.assertEquals(2, groups.size(), 'One entry per account; contacts without an account are skipped');
        System.assertEquals('Ann', groups.get(A1)[0].LastName, 'Keep input order within an account');
        System.assertEquals('Bob', groups.get(A1)[1].LastName, 'Keep input order within an account');
        System.assertEquals(1, groups.get(A2).size());
    }

    @isTest
    static void countsPerAccount() {
        Map<Id, Integer> counts = SfcContactIndex.countByAccount(sample());
        System.assertNotEquals(null, counts, 'countByAccount must return a map, not null');
        System.assertEquals(2, counts.get(A1));
        System.assertEquals(1, counts.get(A2));
        System.assertEquals(2, counts.size(), 'No entry for contacts without an account');
    }

    @isTest
    static void emptyAndNullInputs() {
        System.assertEquals(0, SfcContactIndex.byAccount(null).size(), 'null input gives an empty map');
        System.assertEquals(0, SfcContactIndex.byAccount(new List<Contact>()).size());
        System.assertEquals(0, SfcContactIndex.countByAccount(null).size(), 'null input gives an empty map');
    }
}
