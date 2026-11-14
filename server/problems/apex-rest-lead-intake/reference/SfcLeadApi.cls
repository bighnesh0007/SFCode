@RestResource(urlMapping='/sfc/leads')
global with sharing class SfcLeadApi {
    global class Result {
        global Id id;
        global Boolean created;
        global String error;
    }

    @HttpPost
    global static Result intake(String email, String lastName, String company) {
        Result r = new Result();
        if (String.isBlank(email)) {
            RestContext.response.statusCode = 400;
            r.error = 'email is required';
            return r;
        }
        String co = String.isBlank(company) ? 'Unknown' : company;
        List<Lead> existing = [SELECT Id FROM Lead WHERE Email = :email LIMIT 1];
        if (!existing.isEmpty()) {
            Lead l = existing[0];
            l.LastName = lastName;
            l.Company = co;
            update l;
            r.id = l.Id;
            r.created = false;
            RestContext.response.statusCode = 200;
        } else {
            Lead l = new Lead(Email = email, LastName = lastName, Company = co);
            insert l;
            r.id = l.Id;
            r.created = true;
            RestContext.response.statusCode = 201;
        }
        return r;
    }
}
