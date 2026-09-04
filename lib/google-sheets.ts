import { google } from 'googleapis';

function getSpreadsheetId(): string {
  let id = (process.env.GOOGLE_SHEET_ID || '').trim();
  return id.replace(/^["']|["']$/g, '');
}

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
  isPostable: boolean;
  verifiedStatus: 'unreviewed' | 'verified' | 'disputed' | 'not_independently_verifiable';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
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
  let email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  email = email.replace(/^["']|["']$/g, '');

  let privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  privateKey = privateKey.replace(/^["']|["']$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');

  const spreadsheetId = getSpreadsheetId();

  if (!email || !privateKey || !spreadsheetId) {
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
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const tabExists = meta.data.sheets?.some(
    (sheet) => sheet.properties?.title === TAB_NAME
  );

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
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
    spreadsheetId: getSpreadsheetId(),
    range: `${TAB_NAME}!A1:H1`,
  });

  const row = response.data.values;
  if (!row || row.length === 0 || row[0].length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
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
    spreadsheetId: getSpreadsheetId(),
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
    spreadsheetId: getSpreadsheetId(),
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

export async function updateSubmissionItemVerification(params: {
  date: string;
  person: string;
  account: string;
  entryType: string;
  itemIndex: number;
  verifiedStatus: 'unreviewed' | 'verified' | 'disputed' | 'not_independently_verifiable';
  verifiedBy?: string;
}): Promise<boolean> {
  const sheets = getSheetsClient();
  await initializeSheet();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${TAB_NAME}!A2:H`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return false;
  }

  // Find matching row
  const matchIndex = rows.findIndex((row) => {
    const rowDate = row[1] || '';
    const rowPerson = (row[2] || '').toLowerCase().trim();
    const rowAccount = (row[3] || '').toLowerCase().trim();
    const rowType = row[4] || '';

    return (
      rowDate === params.date &&
      rowPerson === params.person.toLowerCase().trim() &&
      rowAccount === params.account.toLowerCase().trim() &&
      rowType === params.entryType
    );
  });

  if (matchIndex === -1) {
    return false;
  }

  const rowIndex = matchIndex + 2; // +2 for 1-based index and header row
  const targetRow = rows[matchIndex];
  let items: ActivityItem[] = [];
  try {
    items = JSON.parse(targetRow[7] || '[]');
  } catch (e) {
    return false;
  }

  if (params.itemIndex < 0 || params.itemIndex >= items.length) {
    return false;
  }

  // Read-Modify-Write item verification status
  items[params.itemIndex].verifiedStatus = params.verifiedStatus;
  items[params.itemIndex].verifiedBy = params.verifiedBy || 'NeuraTantraAI Reviewer';
  items[params.itemIndex].verifiedAt = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${TAB_NAME}!H${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[JSON.stringify(items)]],
    },
  });

  return true;
}
