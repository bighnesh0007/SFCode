trigger SfcAccountRating on Account (before insert) {
    for (Account a : Trigger.new) {
        if (a.Industry == 'Technology' && String.isBlank(a.Rating)) {
            a.Rating = 'Hot';
        }
    }
}
