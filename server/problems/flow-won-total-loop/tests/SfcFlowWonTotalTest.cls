@isTest
private class SfcFlowWonTotalTest {
    static Decimal totalFor(List<Opportunity> opps) {
        Flow.Interview flow = Flow.Interview.createInterview('SFC_Won_Total', new Map<String, Object>{ 'opportunities' => opps });
        flow.start();
        return (Decimal) flow.getVariableValue('wonTotal');
    }

    @isTest
    static void sumsOnlyClosedWon() {
        List<Opportunity> opps = new List<Opportunity>{
            new Opportunity(Name = 'A', StageName = 'Closed Won', Amount = 100),
            new Opportunity(Name = 'B', StageName = 'Prospecting', Amount = 1000),
            new Opportunity(Name = 'C', StageName = 'Closed Won', Amount = 250.50),
            new Opportunity(Name = 'D', StageName = 'Closed Lost', Amount = 70)
        };
        System.assertEquals(350.50, totalFor(opps), 'Is SFC_Won_Total active? Only Closed Won amounts count: 100 + 250.50');
    }

    @isTest
    static void emptyCollectionIsZero() {
        System.assertEquals(0, totalFor(new List<Opportunity>()), 'An empty collection totals 0');
    }
}
