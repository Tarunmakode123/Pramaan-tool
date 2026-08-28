import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const TAB_NAME = 'Submissions';

export const COLUMN_HEADERS = [
  'Timestamp',
  'Date',
  'Person',
  'Account',
  'EntryType',
  'Platform',
  'PostType',
  'PostCount',
  'OutreachCount',
  'PollsPosted',
  'GroupsJoined',
  'GroupPostCount',
  'EngagementNotes',
  'ContentCreationNotes',
  'RawText',
  'ParsedByAI',
];

export interface Submission {
  timestamp: string;
  date: string;
  person: string;
  account: string;
  entryType: 'Plan' | 'Update';
  platform: string;
  postType: string;
  postCount: number;
  outreachCount: number;
  pollsPosted: number;
  groupsJoined: number;
  groupPostCount: number;
  engagementNotes: string;
  contentCreationNotes: string;
  rawText: string;
  parsedByAI: boolean;
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';

  // Properly handle newlines in Vercel private key env var
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!email || !privateKey || !SPREADSHEET_ID) {
    throw new Error('Missing Google Sheets API configuration environment variables.');
  }

  const auth = new google.auth.JWT(
    email,
    undefined,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
}

export async function initializeSheet(): Promise<void> {
  const sheets = getSheetsClient();

  // 1. Get spreadsheet metadata to see if TAB_NAME exists
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const tabExists = meta.data.sheets?.some(
    (sheet) => sheet.properties?.title === TAB_NAME
  );

  // 2. Create tab if it does not exist
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: TAB_NAME,
              },
            },
          },
        ],
      },
    });
  }

  // 3. Check for headers and write if empty
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A1:P1`,
  });

  const row = response.data.values;
  if (!row || row.length === 0 || row[0].length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TAB_NAME}!A1:P1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [COLUMN_HEADERS],
      },
    });
  }
}

export async function appendSubmission(submission: Omit<Submission, 'timestamp'>): Promise<Submission> {
  const sheets = getSheetsClient();
  await initializeSheet();

  const timestamp = new Date().toISOString();
  const rowData = [
    timestamp,
    submission.date,
    submission.person,
    submission.account,
    submission.entryType,
    submission.platform,
    submission.postType,
    submission.postCount,
    submission.outreachCount,
    submission.pollsPosted,
    submission.groupsJoined,
    submission.groupPostCount,
    submission.engagementNotes,
    submission.contentCreationNotes,
    submission.rawText,
    submission.parsedByAI ? 'TRUE' : 'FALSE',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A:P`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowData],
    },
  });

  return {
    ...submission,
    timestamp,
  };
}

export async function getSubmissions(): Promise<Submission[]> {
  const sheets = getSheetsClient();
  await initializeSheet();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A2:P`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    return {
      timestamp: row[0] || '',
      date: row[1] || '',
      person: row[2] || '',
      account: row[3] || '',
      entryType: (row[4] || 'Plan') as 'Plan' | 'Update',
      platform: row[5] || '',
      postType: row[6] || '',
      postCount: parseInt(row[7] || '0', 10) || 0,
      outreachCount: parseInt(row[8] || '0', 10) || 0,
      pollsPosted: parseInt(row[9] || '0', 10) || 0,
      groupsJoined: parseInt(row[10] || '0', 10) || 0,
      groupPostCount: parseInt(row[11] || '0', 10) || 0,
      engagementNotes: row[12] || '',
      contentCreationNotes: row[13] || '',
      rawText: row[14] || '',
      parsedByAI: row[15] === 'TRUE',
    };
  });
}
