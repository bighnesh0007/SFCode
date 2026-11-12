trigger SfcProtectClosedWon on Opportunity (before delete) {
    for (Opportunity o : Trigger.old) {
        if (o.StageName == 'Closed Won') {
            o.addError('Closed Won opportunities cannot be deleted.');
        }
    }
}
