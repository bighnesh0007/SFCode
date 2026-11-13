@isTest
private class SfcRegionTaggerTest {
    @isTest
    static void knownCountries() {
        System.assertEquals('APAC', SfcRegionTagger.regionFor('India'));
        System.assertEquals('EMEA', SfcRegionTagger.regionFor('France'));
        System.assertEquals('AMER', SfcRegionTagger.regionFor('Canada'));
    }

    @isTest
    static void ignoresCaseAndSpaces() {
        System.assertEquals('APAC', SfcRegionTagger.regionFor(' INDIA '));
        System.assertEquals('AMER', SfcRegionTagger.regionFor('united states'));
    }

    @isTest
    static void unknownIsOther() {
        System.assertEquals('Other', SfcRegionTagger.regionFor('Brazil'), 'Unknown countries return Other instead of crashing');
        System.assertEquals('Other', SfcRegionTagger.regionFor(null));
        System.assertEquals('Other', SfcRegionTagger.regionFor(''));
    }
}
