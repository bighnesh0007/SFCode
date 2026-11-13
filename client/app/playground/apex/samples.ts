/** Starter snippets for the Apex Playground. Read-only by default: they query, never write. */
export interface ApexSample {
  id: string;
  group: string;
  title: string;
  code: string;
}

export const APEX_SAMPLES: readonly ApexSample[] = [
  {
    id: "hello",
    group: "Basics",
    title: "Hello, Apex",
    code: `// Anonymous Apex runs in your connected org. Ctrl/Cmd+Enter to run.
String greeting = 'Hello from ' + UserInfo.getUserName();
System.debug(greeting);
System.debug('Org: ' + UserInfo.getOrganizationName());
`,
  },
  {
    id: "soql",
    group: "SOQL",
    title: "SOQL + collections",
    code: `List<Account> accounts = [SELECT Id, Name, (SELECT Id FROM Contacts) FROM Account ORDER BY CreatedDate DESC LIMIT 5];
Map<Id, Integer> contactCounts = new Map<Id, Integer>();
for (Account a : accounts) {
    contactCounts.put(a.Id, a.Contacts.size());
}
System.debug(contactCounts);
`,
  },
  {
    id: "limits",
    group: "Limits",
    title: "Governor limits",
    code: `System.debug('SOQL queries: ' + Limits.getQueries() + ' / ' + Limits.getLimitQueries());
System.debug('CPU time (ms): ' + Limits.getCpuTime() + ' / ' + Limits.getLimitCpuTime());
System.debug('Heap (bytes): ' + Limits.getHeapSize() + ' / ' + Limits.getLimitHeapSize());
`,
  },
  {
    id: "exception",
    group: "Exceptions",
    title: "Handling exceptions",
    code: `try {
    Integer x = 1 / 0;
} catch (MathException e) {
    System.debug('Caught: ' + e.getMessage());
}
// Remove the try/catch to see how an uncaught exception is reported.
`,
  },
  {
    id: "collections",
    group: "Basics",
    title: "Lists, sets and maps",
    code: `List<String> fruits = new List<String>{ 'apple', 'banana', 'apple', 'cherry' };
Set<String> unique = new Set<String>(fruits);
Map<String, Integer> lengths = new Map<String, Integer>();
for (String f : unique) {
    lengths.put(f, f.length());
}
System.debug('List: ' + fruits);
System.debug('Set: ' + unique);
System.debug('Map: ' + lengths);
`,
  },
  {
    id: "strings",
    group: "Basics",
    title: "String methods",
    code: `String s = '  Salesforce Developer  ';
System.debug(s.trim().toUpperCase());
System.debug(s.contains('Dev'));
System.debug(String.join(s.trim().split(' '), '-'));
System.debug(String.format('{0} has {1} letters', new List<Object>{ s.trim(), s.trim().length() }));
`,
  },
  {
    id: "aggregate",
    group: "SOQL",
    title: "Aggregate query",
    code: `for (AggregateResult ar : [SELECT Industry, COUNT(Id) total FROM Account GROUP BY Industry]) {
    System.debug(ar.get('Industry') + ': ' + ar.get('total'));
}
`,
  },
  {
    id: "dynamic",
    group: "SOQL",
    title: "Dynamic SOQL with binds",
    code: `String nameFilter = 'A%';
List<Account> rows = Database.queryWithBinds(
    'SELECT Id, Name FROM Account WHERE Name LIKE :nameFilter LIMIT 5',
    new Map<String, Object>{ 'nameFilter' => nameFilter },
    AccessLevel.USER_MODE
);
System.debug(rows);
`,
  },
  {
    id: "dml-rollback",
    group: "DML",
    title: "DML inside a savepoint (rolled back)",
    code: `// Inserts, then rolls back, so nothing stays in your org.
Savepoint sp = Database.setSavepoint();
Account a = new Account(Name = 'SFCode temp');
insert a;
System.debug('Inserted ' + a.Id);
System.debug('DML statements: ' + Limits.getDmlStatements());
Database.rollback(sp);
System.debug('Rolled back: ' + [SELECT COUNT() FROM Account WHERE Id = :a.Id]);
`,
  },
  {
    id: "partial",
    group: "DML",
    title: "Partial success with Database methods",
    code: `Savepoint sp = Database.setSavepoint();
List<Account> accs = new List<Account>{ new Account(Name = 'Valid'), new Account() };
for (Database.SaveResult r : Database.insert(accs, false)) {
    System.debug(r.isSuccess() ? 'ok ' + r.getId() : 'failed: ' + r.getErrors()[0].getMessage());
}
Database.rollback(sp);
`,
  },
  {
    id: "custom-exception",
    group: "Exceptions",
    title: "Custom exception",
    code: `public class BudgetException extends Exception {}

try {
    throw new BudgetException('Over budget by 120');
} catch (BudgetException e) {
    System.debug(e.getTypeName() + ': ' + e.getMessage());
}
`,
  },
  {
    id: "json",
    group: "JSON",
    title: "Serialize and parse JSON",
    code: `Map<String, Object> payload = new Map<String, Object>{ 'name' => 'Ada', 'skills' => new List<String>{ 'Apex', 'LWC' } };
String body = JSON.serialize(payload);
System.debug(body);
Map<String, Object> back = (Map<String, Object>) JSON.deserializeUntyped(body);
System.debug(back.get('skills'));
`,
  },
  {
    id: "dates",
    group: "Basics",
    title: "Dates and times",
    code: `Date today = Date.today();
System.debug('Today: ' + today);
System.debug('Start of month: ' + today.toStartOfMonth());
System.debug('Days to year end: ' + today.daysBetween(Date.newInstance(today.year(), 12, 31)));
System.debug('Now (GMT): ' + Datetime.now().formatGmt('yyyy-MM-dd HH:mm'));
`,
  },
];

export interface SoqlSample {
  id: string;
  title: string;
  code: string;
}

export const SOQL_SAMPLES: readonly SoqlSample[] = [
  { id: "accounts", title: "Recent accounts", code: "SELECT Id, Name, Industry, CreatedDate\nFROM Account\nORDER BY CreatedDate DESC\nLIMIT 10" },
  { id: "parent", title: "Child to parent", code: "SELECT Id, Name, Email, Account.Name\nFROM Contact\nWHERE Account.Name != null\nLIMIT 10" },
  { id: "child", title: "Parent to children", code: "SELECT Name, (SELECT LastName FROM Contacts)\nFROM Account\nLIMIT 10" },
  { id: "aggregate", title: "Group by", code: "SELECT StageName, COUNT(Id) total, SUM(Amount) amount\nFROM Opportunity\nGROUP BY StageName" },
  { id: "dates", title: "Date literals", code: "SELECT Id, Subject, ActivityDate\nFROM Task\nWHERE ActivityDate = LAST_N_DAYS:30\nLIMIT 20" },
];
