## Troubleshooter
AWS SSO setup
Remove sso_session from profile. This will prevent loading of the session.
Then add the session manually, i.e. sso_start_url and sso_region.

```properties
[profile dev.nonprod@forgedandfound]
sso_session = forgedandfound-nonprod     # <-- remove this line
sso_account_id = 939103584423
sso_role_name = PowerUserAccess
region = eu-west-2
output = json
sso_start_url = https://d-9c674b6222.awsapps.com/start
sso_region = eu-west-2
```