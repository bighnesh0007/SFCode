public with sharing class SfcRegionTagger {
    // Keys are lower-case so lookups can ignore the input's capitalisation.
    private static final Map<String, String> REGIONS = new Map<String, String>{
        'india' => 'APAC',
        'germany' => 'EMEA',
        'france' => 'EMEA',
        'united states' => 'AMER',
        'canada' => 'AMER'
    };

    public static String regionFor(String country) {
        if (String.isBlank(country)) {
            return 'Other';
        }
        String region = REGIONS.get(country.trim().toLowerCase());
        return region == null ? 'Other' : region;
    }
}
