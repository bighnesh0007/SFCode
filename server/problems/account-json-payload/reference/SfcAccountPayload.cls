public with sharing class SfcAccountPayload {
    public class Item {
        public String name;
        public String industry;
        public Integer employees;
    }

    public static String toJson(List<Account> accounts) {
        List<Item> items = new List<Item>();
        for (Account a : accounts == null ? new List<Account>() : accounts) {
            Item i = new Item();
            i.name = a.Name;
            i.industry = a.Industry;
            i.employees = a.NumberOfEmployees;
            items.add(i);
        }
        return JSON.serialize(items);
    }

    public static List<Account> fromJson(String body) {
        List<Account> out = new List<Account>();
        if (String.isBlank(body)) return out;
        for (Item i : (List<Item>) JSON.deserialize(body, List<Item>.class)) {
            out.add(new Account(Name = i.name, Industry = i.industry, NumberOfEmployees = i.employees));
        }
        return out;
    }
}
