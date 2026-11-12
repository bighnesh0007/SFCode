public with sharing class SfcDiscount {
    public static Decimal discounted(Decimal amount, Decimal percent) {
        Decimal off = amount * percent / 100;
        return (amount - off).setScale(2);
    }
}
