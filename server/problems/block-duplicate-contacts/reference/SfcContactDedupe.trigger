trigger SfcContactDedupe on Contact (before insert) {
    Set<String> incoming = new Set<String>();
    for (Contact c : Trigger.new) {
        if (c.Email != null) {
            incoming.add(c.Email.toLowerCase());
        }
    }
    if (incoming.isEmpty()) {
        return;
    }
    // Email filters are case-insensitive in SOQL, so lower-case values match any stored case.
    Set<String> taken = new Set<String>();
    for (Contact existing : [SELECT Email FROM Contact WHERE Email IN :incoming]) {
        taken.add(existing.Email.toLowerCase());
    }
    for (Contact c : Trigger.new) {
        if (c.Email == null) {
            continue;
        }
        String key = c.Email.toLowerCase();
        if (taken.contains(key)) {
            c.addError('A contact with this email already exists.');
        } else {
            taken.add(key);
        }
    }
}
