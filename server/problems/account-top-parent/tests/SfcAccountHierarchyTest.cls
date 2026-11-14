@isTest
private class SfcAccountHierarchyTest {
    static List<Account> chain(String name, Integer depth) {
        List<Account> levels = new List<Account>();
        Id parent = null;
        for (Integer i = 0; i < depth; i++) {
            Account a = new Account(Name = name + ' L' + i, ParentId = parent);
            insert a;
            levels.add(a);
            parent = a.Id;
        }
        return levels;
    }

    @isTest
    static void findsTheTopOfAChain() {
        List<Account> c = chain('Acme', 4);
        Map<Id, Id> tops = SfcAccountHierarchy.topParents(new Set<Id>{ c[3].Id, c[1].Id });
        System.assertEquals(c[0].Id, tops.get(c[3].Id), 'The deepest account climbs to the top');
        System.assertEquals(c[0].Id, tops.get(c[1].Id), 'Every account in the chain has the same top parent');
    }

    @isTest
    static void accountWithoutParentIsItsOwnTop() {
        Account solo = new Account(Name = 'Solo');
        insert solo;
        System.assertEquals(solo.Id, SfcAccountHierarchy.topParents(new Set<Id>{ solo.Id }).get(solo.Id));
    }

    @isTest
    static void emptyAndNullInputs() {
        System.assertEquals(0, SfcAccountHierarchy.topParents(new Set<Id>()).size());
        System.assertEquals(0, SfcAccountHierarchy.topParents(null).size(), 'null returns an empty map, not an error');
    }

    @isTest
    static void separateHierarchiesStaySeparate() {
        List<Account> a = chain('A', 3);
        List<Account> b = chain('B', 2);
        Map<Id, Id> tops = SfcAccountHierarchy.topParents(new Set<Id>{ a[2].Id, b[1].Id, a[0].Id });
        System.assertEquals(a[0].Id, tops.get(a[2].Id));
        System.assertEquals(b[0].Id, tops.get(b[1].Id));
        System.assertEquals(a[0].Id, tops.get(a[0].Id));
        System.assertEquals(3, tops.size(), 'One entry per input Id');
    }

    @isTest
    static void bulkDeepHierarchyStaysWithinLimits() {
        List<Account> roots = new List<Account>();
        for (Integer i = 0; i < 40; i++) roots.add(new Account(Name = 'Root ' + i));
        insert roots;
        List<Account> level = roots;
        Set<Id> leaves = new Set<Id>();
        for (Integer d = 1; d <= 4; d++) {
            List<Account> next = new List<Account>();
            for (Account p : level) next.add(new Account(Name = p.Name + '/' + d, ParentId = p.Id));
            insert next;
            level = next;
        }
        List<Account> all = [SELECT Id FROM Account];
        Set<Id> ids = new Set<Id>();
        for (Account a : all) ids.add(a.Id);
        Test.startTest();
        Map<Id, Id> tops = SfcAccountHierarchy.topParents(ids);
        Integer queries = Limits.getQueries();
        Test.stopTest();
        System.assertEquals(200, tops.size(), '200 accounts in, 200 entries out');
        Set<Id> rootIds = new Map<Id, Account>(roots).keySet();
        for (Id t : tops.values()) System.assert(rootIds.contains(t), 'Every top parent is one of the 40 roots');
        System.assert(queries <= 6, 'Use one query per level, not per account. Used ' + queries + ' queries for a hierarchy 5 levels deep');
    }
}
