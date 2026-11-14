public class SfcLeadScorer {
    private static Set<Id> scored = new Set<Id>();
    @TestVisible private static Integer scoredCount = 0;

    public static void score(List<Lead> leads) {
        for (Lead l : leads) {
            if (l.Id != null && scored.contains(l.Id)) continue;
            l.Rating = (l.AnnualRevenue != null && l.AnnualRevenue > 1000000) ? 'Hot' : 'Warm';
            scoredCount++;
            if (l.Id != null) scored.add(l.Id);
        }
    }
}
