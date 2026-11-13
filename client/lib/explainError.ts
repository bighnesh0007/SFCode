/**
 * "Explain my error": plain-English notes for common Apex and Salesforce errors.
 * Rule-based on purpose: each note is written and reviewed, never generated.
 * The first rule whose pattern matches wins, so put specific rules before general ones.
 */
export interface Explanation {
  title: string;
  /** What it means, in plain words. */
  meaning: string;
  /** What usually fixes it. */
  fix: string;
}

const RULES: { match: RegExp; explain: (m: RegExpMatchArray) => Explanation }[] = [
  {
    match: /Too many SOQL queries: (\d+)/i,
    explain: () => ({ title: "Over the query limit", meaning: "The transaction ran more than 100 SOQL queries (200 in async code). This is almost always a query inside a loop.", fix: "Move the query out of the loop: collect Ids into a Set, run one query with WHERE Id IN :ids, and look results up in a Map." }),
  },
  {
    match: /Too many DML statements: (\d+)/i,
    explain: () => ({ title: "Over the DML limit", meaning: "The transaction ran more than 150 insert/update/delete statements, usually one per record inside a loop.", fix: "Change records inside the loop, add them to a List, and run one DML statement on the list after the loop." }),
  },
  {
    match: /Apex CPU time limit exceeded/i,
    explain: () => ({ title: "Too much processing", meaning: "The code used more than 10 seconds of CPU (60 in async). Nested loops over large lists are the usual cause.", fix: "Replace nested loops with Map lookups, filter in SOQL instead of in Apex, or move large work to Batch Apex." }),
  },
  {
    match: /heap size too large/i,
    explain: () => ({ title: "Out of memory", meaning: "The transaction held more than 6 MB of data (12 MB in async).", fix: "Query only the fields you need, process records in a SOQL for loop or Batch Apex, and don't keep large collections longer than needed." }),
  },
  {
    match: /maximum trigger depth exceeded/i,
    explain: () => ({ title: "Trigger calling itself", meaning: "A trigger updated records that fired the same trigger again, over and over.", fix: "If you're changing the records being saved, use a before trigger and assign to Trigger.new with no DML. Otherwise add a static Set<Id> guard so each record is processed once." }),
  },
  {
    match: /SObject row was retrieved via SOQL without querying the requested field: ([\w.]+)/i,
    explain: (m) => ({ title: "Field not in the query", meaning: `The code read ${m[1] ?? "a field"}, but the SOQL query that loaded the record didn't select it.`, fix: "Add the field to the SELECT list of the query that loads these records." }),
  },
  {
    match: /List has no rows for assignment to SObject/i,
    explain: () => ({ title: "Query found nothing", meaning: "A query was assigned straight to a single record (Account a = [SELECT …]), but it returned no rows.", fix: "Assign to a List and check it isn't empty first, or make sure the test data matches the query's filters." }),
  },
  {
    match: /List index out of bounds: (-?\d+)/i,
    explain: (m) => ({ title: "Index past the end of a list", meaning: `The code read position ${m[1] ?? "?"} of a list that doesn't have that many items. Lists start at 0.`, fix: "Check list.size() before reading by index, or loop over the list instead." }),
  },
  {
    match: /NullPointerException|Attempt to de-reference a null object/i,
    explain: () => ({ title: "Something was null", meaning: "The code called a method or read a field on a value that was null: an empty field, a missing map key, or a variable never set.", fix: "Find the line in the stack trace and check the value for null first (or use the ?. safe navigation operator). Remember map.get() returns null for a missing key." }),
  },
  {
    match: /MIXED_DML_OPERATION/i,
    explain: () => ({ title: "Setup and data records mixed", meaning: "One transaction changed a setup object (User, Group, permission records) and a regular object (Account, Contact…). Salesforce doesn't allow that.", fix: "In tests, put the setup-object DML inside System.runAs(). In code, move one of them into async Apex (for example @future)." }),
  },
  {
    match: /FIELD_CUSTOM_VALIDATION_EXCEPTION,?\s*([^:]*)/i,
    explain: () => ({ title: "A validation rule blocked the save", meaning: "The record broke a validation rule in the org; the message after the code is the rule's own error text.", fix: "Set the fields the rule requires in your code or test data, or check whether the rule should apply to this record." }),
  },
  {
    match: /REQUIRED_FIELD_MISSING[^[]*\[([^\]]*)\]/i,
    explain: (m) => ({ title: "Required field missing", meaning: `The record was saved without required field(s): ${m[1] ?? "see the message"}.`, fix: "Set those fields before insert. In tests, give every record the fields its object requires (for example Name on Account, LastName on Contact, StageName and CloseDate on Opportunity)." }),
  },
  {
    match: /INVALID_CROSS_REFERENCE_KEY/i,
    explain: () => ({ title: "Linked to a record that isn't there", meaning: "A lookup or Id field points to a record that doesn't exist, was deleted, or is the wrong type.", fix: "Insert the related record first and use its Id, and check the Id is for the right object." }),
  },
  {
    match: /DUPLICATE_VALUE/i,
    explain: () => ({ title: "Duplicate value", meaning: "A field marked unique (or an external Id) already has this value on another record.", fix: "Use a different value, or upsert on that field instead of inserting." }),
  },
  {
    match: /ENTITY_IS_DELETED/i,
    explain: () => ({ title: "Record already deleted", meaning: "The code tried to update or reference a record that has been deleted in this transaction or earlier.", fix: "Don't keep using records after deleting them; re-query if you need current data." }),
  },
  {
    match: /UNABLE_TO_LOCK_ROW/i,
    explain: () => ({ title: "Record locked by someone else", meaning: "Another transaction was updating the same record (often a shared parent) at the same moment.", fix: "Retry later, and in bulk loads sort child records by parent so they don't compete for the same parent." }),
  },
  {
    match: /Assertion Failed/i,
    explain: () => ({ title: "A test's expectation wasn't met", meaning: "The hidden test checked a result and your code produced something different. The Expected and Got values show the difference.", fix: "Compare Expected with Got, reread the statement for that case (bulk, nulls, exact wording), and try the scenario yourself in the Playground." }),
  },
  {
    match: /Code coverage|coverage of at least 75%|test coverage/i,
    explain: () => ({ title: "Not enough code coverage", meaning: "Some of your code never runs during the hidden tests, so it can't reach 75% coverage.", fix: "Remove code paths the statement doesn't need, especially extra branches and helper methods that are never called." }),
  },
  {
    match: /Variable does not exist: (\w+)/i,
    explain: (m) => ({ title: "Unknown name", meaning: `\`${m[1] ?? "?"}\` isn't declared where it's used: a typo, a variable declared inside a block, or a field name used without its object.`, fix: "Check the spelling and capitalisation, and that the variable is declared before this line in the same scope." }),
  },
  {
    match: /Method does not exist or incorrect signature: (.+)/i,
    explain: () => ({ title: "No such method (or wrong arguments)", meaning: "The method name doesn't exist on that type, or the arguments don't match its parameters in number or type.", fix: "Check the name, the class it belongs to, and the argument types. If the hidden tests call it, make it match the signature in the statement exactly." }),
  },
  {
    match: /Illegal assignment from (\S+) to (\S+)/i,
    explain: (m) => ({ title: "Wrong type", meaning: `A ${m[1] ?? "value"} is being stored in a variable of type ${m[2] ?? "another type"}.`, fix: "Change the variable's type, or convert the value (for example Integer.valueOf, String.valueOf, or a cast)." }),
  },
  {
    match: /Invalid type: (\w+)/i,
    explain: (m) => ({ title: "Unknown type", meaning: `\`${m[1] ?? "?"}\` isn't a class, object or type that exists in the org.`, fix: "Check the spelling, the __c suffix on custom objects, and that any class you depend on is part of your submission." }),
  },
  {
    match: /Missing return statement|Non-void method might not return a value/i,
    explain: () => ({ title: "Missing return", meaning: "A method that declares a return type can finish without returning a value on some path.", fix: "Make sure every branch ends with a return (including after loops and in else branches)." }),
  },
  {
    match: /Unexpected token '([^']*)'|Missing ';'|Expecting '([^']*)'/i,
    explain: () => ({ title: "Syntax error", meaning: "The code isn't valid Apex at that position: often a missing semicolon, bracket or quote on the line before.", fix: "Look at the reported line and the one above it for a missing ;, ), } or a stray character." }),
  },
  {
    match: /Duplicate variable: (\w+)/i,
    explain: (m) => ({ title: "Declared twice", meaning: `\`${m[1] ?? "?"}\` is declared more than once in the same scope.`, fix: "Rename one of them, or drop the type to reassign the existing variable." }),
  },
  {
    match: /You have uncommitted work pending/i,
    explain: () => ({ title: "Callout after DML", meaning: "The code made an HTTP callout after inserting or updating records in the same transaction, which isn't allowed.", fix: "Make the callout first, or move it to async Apex (a Queueable that allows callouts)." }),
  },
];

/** The best explanation for an error message, or null when there's no confident match. */
export function explainError(message: string | null | undefined): Explanation | null {
  if (!message) return null;
  for (const r of RULES) {
    const m = message.match(r.match);
    if (m) return r.explain(m);
  }
  return null;
}
