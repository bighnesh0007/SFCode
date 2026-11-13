@isTest
private class SfcLeadCleanupBatchTest {
    @isTest
    static void ratesWebLeadsCold() {
        Lead web = new Lead(LastName = 'Web', Company = 'A', Status = 'Open - Not Contacted', LeadSource = 'Web', Rating = 'Hot');
        Lead phone = new Lead(LastName = 'Phone', Company = 'B', Status = 'Open - Not Contacted', LeadSource = 'Phone Inquiry', Rating = 'Hot');
        Lead working = new Lead(LastName = 'Working', Company = 'C', Status = 'Working - Contacted', LeadSource = 'Web', Rating = 'Hot');
        insert new List<Lead>{ web, phone, working };
        Test.startTest();
        Database.executeBatch(new SfcLeadCleanupBatch());
        Test.stopTest();
        Map<Id, Lead> after = new Map<Id, Lead>([SELECT Rating FROM Lead]);
        System.assertEquals('Cold', after.get(web.Id).Rating, 'Open web leads should become Cold');
        System.assertEquals('Hot', after.get(phone.Id).Rating, 'Other sources stay as they were');
        System.assertEquals('Hot', after.get(working.Id).Rating, 'Other statuses stay as they were');
    }

    @isTest
    static void fullChunkWithinLimits() {
        List<Lead> leads = new List<Lead>();
        for (Integer i = 0; i < 200; i++) {
            leads.add(new Lead(LastName = 'L' + i, Company = 'Co', Status = 'Open - Not Contacted', LeadSource = 'Web'));
        }
        insert leads;
        Test.startTest();
        Database.executeBatch(new SfcLeadCleanupBatch(), 200);
        Test.stopTest();
        System.assertEquals(200, [SELECT COUNT() FROM Lead WHERE Rating = 'Cold'], 'All 200 leads in one chunk should be updated');
    }
}
