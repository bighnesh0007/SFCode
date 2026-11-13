import assert from "node:assert/strict";
import { test } from "node:test";
import { explainError } from "./explainError";

const title = (msg: string) => explainError(msg)?.title ?? null;

void test("explains the common Apex errors by their real messages", () => {
  assert.equal(title("System.LimitException: Too many SOQL queries: 101"), "Over the query limit");
  assert.equal(title("System.LimitException: Too many DML statements: 151"), "Over the DML limit");
  assert.equal(title("System.NullPointerException: Attempt to de-reference a null object"), "Something was null");
  assert.equal(title("System.QueryException: List has no rows for assignment to SObject"), "Query found nothing");
  assert.equal(title("System.ListException: List index out of bounds: 0"), "Index past the end of a list");
  assert.equal(title("System.DmlException: Insert failed. First exception on row 0; first error: MIXED_DML_OPERATION, DML operation on setup object"), "Setup and data records mixed");
  assert.equal(title("Insert failed. First exception on row 0; first error: FIELD_CUSTOM_VALIDATION_EXCEPTION, Phone is required: []"), "A validation rule blocked the save");
  assert.equal(title("Variable does not exist: acount"), "Unknown name");
  assert.equal(title("Method does not exist or incorrect signature: void format(Integer) from the type SfcTextUtils"), "No such method (or wrong arguments)");
  assert.equal(title("Illegal assignment from String to Integer"), "Wrong type");
  assert.equal(title("Unexpected token 'for'."), "Syntax error");
  assert.equal(title("System.AssertException: Assertion Failed: Expected: 3, Actual: 2"), "A test's expectation wasn't met");
  assert.equal(title("Average test coverage across all Apex Classes and Triggers is 60%, at least 75% test coverage is required."), "Not enough code coverage");
});

void test("specific rules win over general ones", () => {
  // Contains "System." and "Exception" but the field-not-queried rule must win.
  const e = explainError("System.SObjectException: SObject row was retrieved via SOQL without querying the requested field: Account.Industry");
  assert.equal(e?.title, "Field not in the query");
  assert.match(e?.meaning ?? "", /Account\.Industry/);
  assert.match(explainError("REQUIRED_FIELD_MISSING, Required fields are missing: [LastName]: [LastName]")?.meaning ?? "", /LastName/);
});

void test("returns null rather than guessing", () => {
  assert.equal(explainError("Something entirely unknown happened"), null);
  assert.equal(explainError(""), null);
  assert.equal(explainError(null), null);
});
