public with sharing class SfcCaseAgeing {
    public static String bucket(Date opened, Date today) {
        Integer age = today.daysBetween(opened);
        if (age < 7) {
            return 'New';
        } else if (age < 30) {
            return 'Ageing';
        }
        return 'Stale';
    }
}
