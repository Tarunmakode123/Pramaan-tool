import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const TAB_NAME = 'Submissions';

export const COLUMN_HEADERS = [
  'Timestamp',
  'Date',
  'Person',
  'Account',
  'EntryType',
  'RawText',
  'ParsedByAI',
  'ActivityItemsJSON',
];

export interface ActivityItem {
  activityType: string;
  platform: string | null;
  description: string;
  count: number | null;
}

export interface Submission {
  timestamp: string;
  date: string;
  person: string;
  account: string;
  entryType: 'Plan' | 'Update';
  rawText: string;
  parsedByAI: boolean;
  activityItems: ActivityItem[];
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
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

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const tabExists = meta.data.sheets?.some(
    (sheet) => sheet.properties?.title === TAB_NAME
  );

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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A1:H1`,
  });

  const row = response.data.values;
  if (!row || row.length === 0 || row[0].length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TAB_NAME}!A1:H1`,
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
    submission.rawText,
    submission.parsedByAI ? 'TRUE' : 'FALSE',
    JSON.stringify(submission.activityItems),
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A:H`,
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
    range: `${TAB_NAME}!A2:H`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    let parsedItems: ActivityItem[] = [];
    try {
      parsedItems = JSON.parse(row[7] || '[]');
    } catch (e) {
      console.error('Failed to parse ActivityItemsJSON from row:', row, e);
    }

    return {
      timestamp: row[0] || '',
      date: row[1] || '',
      person: row[2] || '',
      account: row[3] || '',
      entryType: (row[4] || 'Plan') as 'Plan' | 'Update',
      rawText: row[5] || '',
      parsedByAI: row[6] === 'TRUE',
      activityItems: parsedItems,
    };
  });
}
