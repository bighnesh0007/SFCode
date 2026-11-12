trigger SfcAccountStamp on Account (before update) {
    for (Account a : Trigger.new) {
        a.Description = 'Reviewed';
    }
}
