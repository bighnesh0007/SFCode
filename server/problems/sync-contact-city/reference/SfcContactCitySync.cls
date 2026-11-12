public with sharing class SfcContactCitySync implements Queueable {
    private final Set<Id> accountIds;

    public SfcContactCitySync(Set<Id> accountIds) {
        this.accountIds = accountIds;
    }

    public void execute(QueueableContext context) {
        List<Contact> contacts = [
            SELECT Id, Account.BillingCity FROM Contact WHERE AccountId IN :accountIds
        ];
        for (Contact c : contacts) {
            c.MailingCity = c.Account.BillingCity;
        }
        update contacts;
    }
}
