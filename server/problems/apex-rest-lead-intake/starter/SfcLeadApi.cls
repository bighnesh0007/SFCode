@RestResource(urlMapping='/sfc/leads')
global with sharing class SfcLeadApi {
    global class Result {
        global Id id;
        global Boolean created;
        global String error;
    }

    @HttpPost
    global static Result intake(String email, String lastName, String company) {
        // Your code here
        return new Result();
    }
}
