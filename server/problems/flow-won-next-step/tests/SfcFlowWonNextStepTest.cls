@isTest
private class SfcFlowWonNextStepTest {
    static Opportunity opp(String stage) {
        return new Opportunity(Name = stage, StageName = stage, CloseDate = Date.today(), NextStep = 'Call them');
    }

    @isTest
    static void setsNextStepWhenCreatedWon() {
        Opportunity o = opp('Closed Won');
        insert o;
        System.assertEquals('Hand off to onboarding', [SELECT NextStep FROM Opportunity WHERE Id = :o.Id].NextStep,
            'Is SFC_Opportunity_Won_Next_Step active? A Closed Won opportunity needs the onboarding next step');
    }

    @isTest
    static void setsNextStepWhenUpdatedToWon() {
        Opportunity o = opp('Prospecting');
        insert o;
        o.StageName = 'Closed Won';
        update o;
        System.assertEquals('Hand off to onboarding', [SELECT NextStep FROM Opportunity WHERE Id = :o.Id].NextStep,
            'Updating an opportunity to Closed Won should set the next step too');
    }

    @isTest
    static void leavesOtherStagesAlone() {
        Opportunity o = opp('Prospecting');
        insert o;
        System.assertEquals('Call them', [SELECT NextStep FROM Opportunity WHERE Id = :o.Id].NextStep, 'Other stages keep their NextStep');
    }
}
