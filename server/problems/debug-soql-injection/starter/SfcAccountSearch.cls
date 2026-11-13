public with sharing class SfcAccountSearch {
    public static List<String> byIndustry(String industry) {
        String soql = 'SELECT Name FROM Account WHERE Industry = \'' + industry + '\' ORDER BY Name';
        List<String> names = new List<String>();
        for (Account a : Database.query(soql)) {
            names.add(a.Name);
        }
        return names;
    }
}
