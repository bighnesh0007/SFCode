@isTest
private class SfcLeadApiTest {
    static void context() {
        RestContext.request = new RestRequest();
        RestContext.request.requestURI = '/services/apexrest/sfc/leads';
        RestContext.request.httpMethod = 'POST';
        RestContext.response = new RestResponse();
    }

    @isTest
    static void createsANewLeadWith201() {
        context();
        SfcLeadApi.Result r = SfcLeadApi.intake('ada@example.com', 'Lovelace', 'Analytical Engines');
        System.assertEquals(true, r.created, 'A new email creates a lead');
        System.assertEquals(201, RestContext.response.statusCode, 'New records return 201 Created');
        Lead l = [SELECT Email, LastName, Company FROM Lead WHERE Id = :r.id];
        System.assertEquals('Lovelace', l.LastName);
        System.assertEquals('Analytical Engines', l.Company);
    }

    @isTest
    static void retryUpdatesInsteadOfDuplicating() {
        context();
        SfcLeadApi.Result first = SfcLeadApi.intake('ada@example.com', 'Lovelace', 'Old Co');
        context();
        SfcLeadApi.Result second = SfcLeadApi.intake('ada@example.com', 'King', 'New Co');
        System.assertEquals(1, [SELECT COUNT() FROM Lead WHERE Email = 'ada@example.com'], 'A retry with the same email must not create a duplicate');
        System.assertEquals(first.id, second.id, 'The same lead is returned');
        System.assertEquals(false, second.created);
        System.assertEquals(200, RestContext.response.statusCode, 'Updates return 200');
        System.assertEquals('New Co', [SELECT Company FROM Lead WHERE Id = :first.id].Company, 'The existing lead is updated');
    }

    @isTest
    static void blankEmailIs400AndSavesNothing() {
        context();
        SfcLeadApi.Result r = SfcLeadApi.intake('  ', 'Nobody', 'Co');
        System.assertEquals(400, RestContext.response.statusCode);
        System.assertEquals('email is required', r.error);
        System.assertEquals(0, [SELECT COUNT() FROM Lead], 'Nothing is saved for invalid input');
    }

    @isTest
    static void missingCompanyBecomesUnknown() {
        context();
        SfcLeadApi.Result r = SfcLeadApi.intake('grace@example.com', 'Hopper', null);
        System.assertEquals('Unknown', [SELECT Company FROM Lead WHERE Id = :r.id].Company, 'Company is required on Lead, so default it');
    }
}
