    // ── Pasted into each SOQL test class by the grader (server/problems/_shared) ──
    // Compares two query results field by field, ignoring field order and key
    // case. Lives inside the test class because test classes are exempt from
    // the 75% coverage rule; a separate helper class would not be.

    private static String sfcNormalize(Object value) {
        if (value instanceof List<SObject>) {
            List<String> rows = new List<String>();
            for (SObject child : (List<SObject>) value) {
                rows.add(sfcNormalize(child));
            }
            return '[' + String.join(rows, ', ') + ']';
        }
        if (value instanceof SObject) {
            Map<String, Object> fields = ((SObject) value).getPopulatedFieldsAsMap();
            Map<String, Object> byKey = new Map<String, Object>();
            for (String key : fields.keySet()) {
                byKey.put(key.toLowerCase(), fields.get(key));
            }
            List<String> keys = new List<String>(byKey.keySet());
            keys.sort();
            List<String> parts = new List<String>();
            for (String key : keys) {
                parts.add(key + '=' + sfcNormalize(byKey.get(key)));
            }
            return '{' + String.join(parts, ', ') + '}';
        }
        return String.valueOf(value);
    }

    private static void sfcAssertSameRows(List<SObject> expected, List<SObject> actual, Boolean ordered) {
        List<String> want = new List<String>();
        for (SObject row : expected) {
            want.add(sfcNormalize(row));
        }
        List<String> got = new List<String>();
        for (SObject row : actual) {
            got.add(sfcNormalize(row));
        }
        if (!ordered) {
            want.sort();
            got.sort();
        }
        System.assertEquals(want.size(), got.size(), 'Your query returned ' + got.size() + ' rows; expected ' + want.size() + '.');
        for (Integer i = 0; i < want.size(); i++) {
            System.assertEquals(want[i], got[i], ordered ? 'Row ' + (i + 1) + ' is wrong (order matters here).' : 'A row is wrong.');
        }
    }

    private static List<SObject> sfcRunSubmission() {
        try {
            return Database.query(SfcSoqlSubmission.QUERY);
        } catch (QueryException e) {
            System.assert(false, 'Your query failed: ' + e.getMessage());
            return null;
        }
    }
