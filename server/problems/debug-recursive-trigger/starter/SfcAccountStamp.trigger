trigger SfcAccountStamp on Account (after update) {
    List<Account> stamped = new List<Account>();
    for (Account a : Trigger.new) {
        stamped.add(new Account(Id = a.Id, Description = 'Reviewed'));
    }
    update stamped;
}
