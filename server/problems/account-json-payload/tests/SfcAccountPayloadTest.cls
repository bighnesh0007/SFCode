@isTest
private class SfcAccountPayloadTest {
    @isTest
    static void serialisesInOrderWithTheWireNames() {
        String body = SfcAccountPayload.toJson(new List<Account>{
            new Account(Name = 'Acme "Labs"', Industry = 'Technology', NumberOfEmployees = 120),
            new Account(Name = 'Globex', Industry = null, NumberOfEmployees = 5)
        });
        List<Object> parsed = (List<Object>) JSON.deserializeUntyped(body);
        System.assertEquals(2, parsed.size());
        Map<String, Object> first = (Map<String, Object>) parsed[0];
        System.assertEquals('Acme "Labs"', first.get('name'), 'Quotes in names must survive: use JSON.serialize, not concatenation');
        System.assertEquals('Technology', first.get('industry'));
        System.assertEquals(120, first.get('employees'));
        System.assertEquals('Globex', ((Map<String, Object>) parsed[1]).get('name'), 'Keep the list order');
    }

    @isTest
    static void emptyAndNullGiveAnEmptyArray() {
        System.assertEquals('[]', SfcAccountPayload.toJson(new List<Account>()));
        System.assertEquals('[]', SfcAccountPayload.toJson(null));
    }

    @isTest
    static void parsesBackIntoAccounts() {
        List<Account> accounts = SfcAccountPayload.fromJson('[{"name":"Acme","industry":"Energy","employees":42},{"name":"Initech"}]');
        System.assertEquals(2, accounts.size());
        System.assertEquals('Acme', accounts[0].Name);
        System.assertEquals('Energy', accounts[0].Industry);
        System.assertEquals(42, accounts[0].NumberOfEmployees);
        System.assertEquals(null, accounts[1].NumberOfEmployees, 'A missing employees field stays null');
        System.assertEquals(null, accounts[0].Id, 'Parsed accounts are not saved');
    }

    @isTest
    static void blankInputGivesAnEmptyList() {
        System.assertEquals(0, SfcAccountPayload.fromJson('').size());
        System.assertEquals(0, SfcAccountPayload.fromJson(null).size());
    }

    @isTest
    static void roundTrip() {
        List<Account> again = SfcAccountPayload.fromJson(SfcAccountPayload.toJson(new List<Account>{ new Account(Name = 'Round', Industry = 'Retail', NumberOfEmployees = 7) }));
        System.assertEquals('Round', again[0].Name);
        System.assertEquals('Retail', again[0].Industry);
        System.assertEquals(7, again[0].NumberOfEmployees);
    }
}
