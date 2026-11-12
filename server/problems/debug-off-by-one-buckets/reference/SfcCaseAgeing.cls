public with sharing class SfcCaseAgeing {
    public static String bucket(Date opened, Date today) {
        if (opened == null || today == null || opened > today) {
            return 'Invalid';
        }
        Integer age = opened.daysBetween(today);
        if (age <= 7) {
            return 'New';
        } else if (age <= 30) {
            return 'Ageing';
        }
        return 'Stale';
    }
}
