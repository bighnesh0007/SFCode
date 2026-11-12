@isTest
private class SfcFlowShippingCostTest {
    static Decimal costFor(Decimal weightKg) {
        Flow.Interview flow = Flow.Interview.createInterview('SFC_Shipping_Cost', new Map<String, Object>{ 'weightKg' => weightKg });
        flow.start();
        return (Decimal) flow.getVariableValue('cost');
    }

    @isTest
    static void baseCostWithNoWeight() {
        System.assertEquals(5, costFor(0), 'Is SFC_Shipping_Cost active, with weightKg as input and cost as output? 0 kg costs 5');
    }

    @isTest
    static void addsTwoPerKg() {
        System.assertEquals(11, costFor(3), '3 kg costs 5 + 2 x 3 = 11');
        System.assertEquals(8, costFor(1.5), '1.5 kg costs 5 + 2 x 1.5 = 8');
    }

    @isTest
    static void capsAtFifty() {
        System.assertEquals(50, costFor(22.5), '5 + 2 x 22.5 = 50 exactly');
        System.assertEquals(50, costFor(40), 'Never more than 50');
    }
}
