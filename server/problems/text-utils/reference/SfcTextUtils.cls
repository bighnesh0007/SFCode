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
