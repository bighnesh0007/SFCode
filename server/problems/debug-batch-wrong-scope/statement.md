`SfcLeadCleanupBatch` should mark every **Open - Not Contacted** lead created from
the web (`LeadSource = 'Web'`) as `Rating = 'Cold'`. It runs without errors, but
leads come out unchanged, and with many leads it fails with a governor-limit error.

**Find and fix the bugs.** Leads with any other status or source must stay as they were.
