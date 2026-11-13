trigger SfcCaseUrgency on Case (before insert) {
    for (Case c : Trigger.new) {
        if (c.Subject != null && c.Subject.containsIgnoreCase('urgent')) {
            c.Priority = 'High';
        }
    }
}
