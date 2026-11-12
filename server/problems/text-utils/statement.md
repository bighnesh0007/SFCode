Implement two static methods on `SfcTextUtils`.

**`String toTitleCase(String input)`** — capitalise the first letter of each
word and lower-case the rest. Words are separated by single spaces.
Return `null` for `null`.

- `'hello WORLD'` → `'Hello World'`
- `''` → `''`

**`Boolean isPalindrome(String input)`** — `true` if the text reads the same
backwards, **ignoring case and any character that is not a letter or digit**.
`null` is not a palindrome.

- `'A man, a plan, a canal: Panama'` → `true`
- `'Apex'` → `false`
