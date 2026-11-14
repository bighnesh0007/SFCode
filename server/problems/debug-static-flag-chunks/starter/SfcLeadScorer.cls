public class SfcLeadScorer {
    // Stops the scorer running twice in one transaction.
    private static Boolean hasRun = false;
    @TestVisible private static Integer scoredCount = 0;

    public static void score(List<Lead> leads) {
        if (hasRun) return;
        hasRun = true;
        for (Lead l : leads) {
            l.Rating = (l.AnnualRevenue != null && l.AnnualRevenue > 1000000) ? 'Hot' : 'Warm';
            scoredCount++;
        }
    }
}
