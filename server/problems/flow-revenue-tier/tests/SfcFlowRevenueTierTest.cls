@isTest
private class SfcFlowRevenueTierTest {
    static String ratingFor(Decimal revenue) {
        Account a = new Account(Name = 'Tier', AnnualRevenue = revenue);
        insert a;
        return [SELECT Rating FROM Account WHERE Id = :a.Id].Rating;
    }

    @isTest
    static void hotAtTenMillionAndAbove() {
        System.assertEquals('Hot', ratingFor(10000000), 'Is SFC_Rate_By_Revenue active? 10,000,000 is Hot');
        System.assertEquals('Hot', ratingFor(50000000), '50,000,000 is Hot');
    }

    @isTest
    static void warmFromOneMillion() {
        System.assertEquals('Warm', ratingFor(1000000), '1,000,000 is Warm (not Cold)');
        System.assertEquals('Warm', ratingFor(9999999), '9,999,999 is Warm (not Hot)');
    }

    @isTest
    static void coldBelowOneMillionOrBlank() {
        System.assertEquals('Cold', ratingFor(999999), 'Just below 1,000,000 is Cold');
        System.assertEquals('Cold', ratingFor(null), 'Blank revenue is Cold');
    }
}
