/** Starter snippets for the Apex Playground. Read-only by default: they query, never write. */
export interface ApexSample {
  id: string;
  title: string;
  code: string;
}

export const APEX_SAMPLES: readonly ApexSample[] = [
  {
    id: "hello",
    title: "Hello, Apex",
    code: `// Anonymous Apex runs in your connected org. Ctrl/Cmd+Enter to run.
String greeting = 'Hello from ' + UserInfo.getUserName();
System.debug(greeting);
System.debug('Org: ' + UserInfo.getOrganizationName());
`,
  },
  {
    id: "soql",
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
    title: "Governor limits",
    code: `System.debug('SOQL queries: ' + Limits.getQueries() + ' / ' + Limits.getLimitQueries());
System.debug('CPU time (ms): ' + Limits.getCpuTime() + ' / ' + Limits.getLimitCpuTime());
System.debug('Heap (bytes): ' + Limits.getHeapSize() + ' / ' + Limits.getLimitHeapSize());
`,
  },
  {
    id: "exception",
    title: "Handling exceptions",
    code: `try {
    Integer x = 1 / 0;
} catch (MathException e) {
    System.debug('Caught: ' + e.getMessage());
}
// Remove the try/catch to see how an uncaught exception is reported.
`,
  },
];
