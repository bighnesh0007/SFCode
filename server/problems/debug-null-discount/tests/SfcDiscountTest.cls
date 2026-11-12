@isTest
private class SfcDiscountTest {
    @isTest
    static void appliesPercentage() {
        System.assertEquals(170.00, SfcDiscount.discounted(200, 15));
    }

    @isTest
    static void roundsHalfUp() {
        System.assertEquals(6.67, SfcDiscount.discounted(10, 33.333), '10 - 3.3333 = 6.6667 rounds to 6.67');
    }

    @isTest
    static void nullAmountIsZero() {
        System.assertEquals(0, SfcDiscount.discounted(null, 10));
    }

    @isTest
    static void nullPercentMeansNoDiscount() {
        System.assertEquals(99.50, SfcDiscount.discounted(99.5, null));
    }

    @isTest
    static void clampsPercent() {
        System.assertEquals(50.00, SfcDiscount.discounted(50, -20), 'Negative percent is treated as 0');
        System.assertEquals(0.00, SfcDiscount.discounted(50, 150), 'Over 100 is treated as 100');
    }
}
