@isTest
private class SfcAccountStampTest {
    @isTest
    static void stampsOnUpdate() {
        Account a = new Account(Name = 'A');
        insert a;
        a.Name = 'A2';
        update a;
        System.assertEquals('Reviewed', [SELECT Description FROM Account WHERE Id = :a.Id].Description);
    }

    @isTest
    static void bulkUpdateWithoutExtraDml() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'B' + i));
        }
        insert accounts;
        for (Account a : accounts) {
            a.Name = a.Name + '!';
        }
        Test.startTest();
        update accounts;
        Integer dml = Limits.getDmlStatements();
        Test.stopTest();
        System.assertEquals(1, dml, 'Only the test\'s own update should count as DML');
        // Description is a long text area: not filterable in SOQL, so count in Apex.
        Integer stamped = 0;
        for (Account a : [SELECT Description FROM Account]) {
            if (a.Description == 'Reviewed') {
                stamped++;
            }
        }
        System.assertEquals(200, stamped, 'Every updated account should be stamped');
    }
}
