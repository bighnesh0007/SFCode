## Approach

**Title case.** `split(' ', -1)` keeps empty strings between repeated spaces. Without the `-1`, trailing empties are dropped and spacing changes. Each non-empty word becomes upper first letter plus lower rest, then `String.join(words, ' ')` restores the original spacing.

**Palindrome.** Normalise first: lower-case, then strip punctuation and spaces with a regex, so *"A man, a plan, a canal: Panama"* works. Then compare the cleaned string with its `reverse()`.

Both methods treat null as a special case: title case returns null, and palindrome returns false.

## Solution

**SfcTextUtils.cls**

```apex
public with sharing class SfcTextUtils {
    public static String toTitleCase(String input) {
        if (input == null) {
            return null;
        }
        List<String> words = new List<String>();
        for (String w : input.split(' ', -1)) {
            words.add(w.length() == 0 ? w : w.substring(0, 1).toUpperCase() + w.substring(1).toLowerCase());
        }
        return String.join(words, ' ');
    }

    public static Boolean isPalindrome(String input) {
        if (input == null) {
            return false;
        }
        String cleaned = input.toLowerCase().replaceAll('[^a-z0-9]', '');
        return cleaned == cleaned.reverse();
    }
}
```
