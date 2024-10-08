import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const apiRoot = process.env.JIRA_API_ROOT || null;
const jiraEmail = process.env.JIRA_API_EMAIL || null;
const jiraToken = process.env.JIRA_API_TOKEN || null;
const jiraProject = process.env.JIRA_API_PROJECT || null;

const googleEmail = process.env.GOOGLE_CLIENT_EMAIL || null;
const googleKey = process.env.GOOGLE_PRIVATE_KEY || null;
const googleSheetId = process.env.GOOGLE_SHEET_ID || null;

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

if (!googleEmail) {
    console.error('No GOOGLE_CLIENT_EMAIL environment variable set');
}
if (!googleKey) {
    console.error('No GOOGLE_PRIVATE_KEY environment variable set');
}
if (!googleSheetId) {
    console.error('No GOOGLE_SHEET_ID environment variable set');
}

const serviceAccountAuth = new JWT({
    // env var values here are copied from service account credentials generated by google
    // see "Authentication" section in docs for more info
    email: googleEmail,
    key: googleKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(googleSheetId, serviceAccountAuth);

updateWorklog();
setInterval(updateWorklog, 1000 * 60 * 5);


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

    const rows = [];
    for (const member in members) {
        rows.push({
            'Team Member': member,
            'Time Logged': formatTime(totalHours(members[member]))
        });

        for (const issueId in members[member]) {
            rows.push({
                'Team Member': member,
                'Time Logged': formatTime(members[member][issueId]),
                'Issue': issues[issueId].key,
                'Summary': issues[issueId].fields.summary,
                'Link': issues[issueId].self
            });
        }

        rows.push({});
    }


    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.clear();
    await sheet.loadCells();
    await sheet.setHeaderRow([
        'Team Member', 
        'Time Logged',
        'Issue',
        'Summary', 
        'Link'
    ]);
    await sheet.addRows(rows);

    console.log(`Inserted ${rows.length} rows`);
}


function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}


function totalHours(member) {
    let total = 0;
    for (const issue in member) {
        total += member[issue];
    }
    return total;
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
