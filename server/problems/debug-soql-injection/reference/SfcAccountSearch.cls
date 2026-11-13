public with sharing class SfcAccountSearch {
    public static List<String> byIndustry(String industry) {
        List<String> names = new List<String>();
        if (String.isBlank(industry)) {
            return names;
        }
        // A bind variable is sent as a value, so quotes in it can't change the query.
        for (Account a : [SELECT Name FROM Account WHERE Industry = :industry ORDER BY Name]) {
            names.add(a.Name);
        }
        return names;
    }
}
