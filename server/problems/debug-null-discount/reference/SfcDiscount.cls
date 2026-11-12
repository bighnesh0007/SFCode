public with sharing class SfcDiscount {
    public static Decimal discounted(Decimal amount, Decimal percent) {
        if (amount == null) {
            return 0;
        }
        Decimal p = percent == null ? 0 : Math.min(Math.max(percent, 0), 100);
        return (amount - amount * p / 100).setScale(2, RoundingMode.HALF_UP);
    }
}
