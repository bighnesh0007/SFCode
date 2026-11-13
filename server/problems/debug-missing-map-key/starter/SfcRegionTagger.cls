public with sharing class SfcRegionTagger {
    private static final Map<String, String> REGIONS = new Map<String, String>{
        'India' => 'APAC',
        'Germany' => 'EMEA',
        'France' => 'EMEA',
        'United States' => 'AMER',
        'Canada' => 'AMER'
    };

    public static String regionFor(String country) {
        String region = REGIONS.get(country);
        return region.toUpperCase();
    }
}
