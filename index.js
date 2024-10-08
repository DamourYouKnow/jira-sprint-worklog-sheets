const apiRoot = process.env.JIRA_API_ROOT || null;
const jiraEmail = process.env.JIRA_API_EMAIL || null;
const jiraToken = process.env.JIRA_API_TOKEN || null;
const jiraProject = process.env.JIRA_API_PROJECT || null;

const authBase64 = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');

// Check that all environment varibles are provided.
if (!apiRoot) {
    console.error('No JIRA_API_ROOT environment variable set');
}
if (!jiraEmail) {
    console.error('No JIRA_API_EMAIL environment variable set');
}
if (!jiraToken) {
    console.error('No JIRA_API_TOKEN environment variable set');
}
if (!jiraProject) {
    console.error('No JIRA_API_PROJECT environment variable set');
}

updateWorklog();


async function updateWorklog() {
    const issues = await jiraSearch(
        `sprint in openSprints() AND project = ${jiraProject}`
    );

    const subtasks = await jiraSearch(
        `type in subTaskIssueTypes() and project = ${jiraProject}`
    );

    // Merge subtasks with parent in issues
    for (const id in subtasks) {
        const subtask = subtasks[id];
        if (subtask.fields.parent.id in issues) {
            issues[subtask.fields] = subtask.fields.parent;
        }
    }

    const issueIds = Object.keys(issues);

    const worklogIds = await jiraRecentWorklogs();

    const worklogs = await jiraPost('worklog/list', {
        'ids': worklogIds
    });

    const members = { };

    for (const worklog of worklogs) {
        if (!(worklog.issueId in issues)) continue; // Issue not in sprint. 

        const member = worklog.updateAuthor.displayName;

        if (!(member in members)) {
            members[member] = {};
        }

        if (!(worklog.issueId in members[member])) {
            // Adding new issue that member worked on.
            members[member][worklog.issueId] = worklog.timeSpentSeconds;
        }
        else {
            // Adding to existing issue that member worked on.
            members[member][worklog.issueId] += worklog.timeSpentSeconds;
        }
    }
}


async function jiraRecentWorklogs() {
    // Get time 2 weeks in past.
    let time = new Date();
    time.setDate(time.getDate() - 14);
    const since = Date.parse(time) / 1000;

    const response = await jiraGet(`worklog/updated?since=${since}`);

    const worklogIds = response.values.map((value) => value.worklogId);
    return worklogIds;
}

async function jiraSearch(jqlQuery, max=50) {
    const issues = { };


    let recordsRead = 0;
    let page = 0;
    let response = null;

    do {
        const body = {
            'fields': [
                'summary',
                'parent'
            ],
            'jql': jqlQuery,
            'startAt': page,
            'maxResults': max
        };

        response = await jiraPost('search', body);

        for (const issue of response.issues) {
            issues[issue.id] = issue;
        }

        recordsRead += max;
        page += 1;
    } while(recordsRead < response.total);

    return issues;
}


function jiraPost(method, body) {
    return new Promise((resolve, reject) => {
        fetch(`${apiRoot}${method}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authBase64}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then((response) =>{
            resolve(response.json());
        }).catch((err) => {
            reject(err);
        });
    });
}


function jiraGet(method) {
    return new Promise((resolve, reject) => {
        fetch(`${apiRoot}${method}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authBase64}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then((response) =>{
            resolve(response.json());
        }).catch((err) => {
            reject(err);
        });
    });
}
