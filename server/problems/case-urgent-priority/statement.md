Support wants urgent cases flagged the moment they arrive.

Write a **before insert** trigger `SfcCaseUrgency` on **Case**: when a new case's
`Subject` contains the word **urgent**, in any capitalisation (*Urgent*,
*URGENT*, *urgent*), set its `Priority` to **High**.

- Cases whose subject doesn't mention it keep whatever `Priority` they were given.
- A blank `Subject` is fine and must not cause an error.
- Must work for 200 cases inserted at once.
