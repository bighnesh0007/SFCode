@isTest
private class SfcCaseAgeingTest {
    static final Date TODAY = Date.newInstance(2026, 3, 31);

    static String ageOf(Integer days) {
        return SfcCaseAgeing.bucket(TODAY.addDays(-days), TODAY);
    }

    @isTest
    static void boundariesOfNew() {
        System.assertEquals('New', ageOf(0));
        System.assertEquals('New', ageOf(7), 'Day 7 is still New');
    }

    @isTest
    static void boundariesOfAgeing() {
        System.assertEquals('Ageing', ageOf(8));
        System.assertEquals('Ageing', ageOf(30), 'Day 30 is still Ageing');
    }

    @isTest
    static void stale() {
        System.assertEquals('Stale', ageOf(31));
        System.assertEquals('Stale', ageOf(400));
    }

    @isTest
    static void invalidInputs() {
        System.assertEquals('Invalid', SfcCaseAgeing.bucket(TODAY.addDays(1), TODAY), 'Opened in the future');
        System.assertEquals('Invalid', SfcCaseAgeing.bucket(null, TODAY));
        System.assertEquals('Invalid', SfcCaseAgeing.bucket(TODAY, null));
    }
}
