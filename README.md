# Jira sprint worklog sheets

This script seperates Jira Cloud worklog entries in the active sprint and 
aggregates hours to their correct team members. Data is written to a Google 
Spreadsheet at a set interval.

Requires Node.js, a Jira Cloud account, and a Google service account.
This guide has good instructions for setting up a Google service account:
- https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication

A few environment variables must be set:
- `JIRA_API_ROOT`: Jira API root url for your organization
    - Example: `https://your-domain.atlassian.net/rest/api/3/`
- `JIRA_API_EMAIL`: Email of Jira account running script
- `JIRA_API_TOKEN`: Jira API token, can be generated from `Atlassian account 
settings > security`
- `JIRA_API_PROJECT`: Jira project name
    - Example: `TeamProject`
- `JIRA_API_BOARD`: Jira board ID
    - Exmaple: `39`
- `GOOGLE_CLIENT_EMAIL`: Google service account email
    - Example: `example@gserviceaccount.com`
- `GOOGLE_PRIVATE_KEY`: Google service account private key
- `GOOGLE_SHEET_ID`: Google sheet ID
