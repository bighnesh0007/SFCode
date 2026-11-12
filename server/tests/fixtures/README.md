# Fixtures

`executeAnonymous-*.xml` follow the response shape in Salesforce's Apex SOAP API
documentation (`ExecuteAnonymousResult` + `DebuggingInfo` header). They were
**not captured from a real org** — no org was connected when they were written.
Replace them with real captures once the External Client App exists:
run the snippet in the playground and save the raw response body.

`deploy-*.xml` and `deployStatus-*.xml` follow the Metadata API `deploy` /
`checkDeployStatus` (`DeployResult`) documentation. Also **not real captures** —
replace with responses recorded from a connected org.
