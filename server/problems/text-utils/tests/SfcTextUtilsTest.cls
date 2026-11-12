@isTest
private class SfcTextUtilsTest {
    @isTest
    static void titleCasesMixedInput() {
        System.assertEquals('Hello World', SfcTextUtils.toTitleCase('hello WORLD'));
        System.assertEquals('Apex', SfcTextUtils.toTitleCase('aPEX'));
    }

    @isTest
    static void titleCaseEdgeCases() {
        System.assertEquals(null, SfcTextUtils.toTitleCase(null), 'null in, null out');
        System.assertEquals('', SfcTextUtils.toTitleCase(''), 'Empty stays empty');
    }

    @isTest
    static void detectsPalindromes() {
        System.assert(SfcTextUtils.isPalindrome('A man, a plan, a canal: Panama'), 'Ignore case and punctuation');
        System.assert(SfcTextUtils.isPalindrome('12321'), 'Digits count');
    }

    @isTest
    static void rejectsNonPalindromes() {
        System.assert(!SfcTextUtils.isPalindrome('Apex'), 'Apex is not a palindrome');
        System.assert(!SfcTextUtils.isPalindrome(null), 'null is not a palindrome');
    }
}
