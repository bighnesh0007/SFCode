trigger SfcLeadScoreTrigger on Lead (before insert, before update) {
    SfcLeadScorer.score(Trigger.new);
}
