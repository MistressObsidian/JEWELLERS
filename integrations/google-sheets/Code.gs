// Paste this file into Google Apps Script. See README.md for deployment steps.
const SPREADSHEET_ID = '12LnVhOXM858v6c6jZ6QIgpKYq-PsbfGX62tEuCH_rIg';
const TAB_NAME = 'Ambassador Applications';
const HEADERS = [
  'Submitted at (UTC)', 'Submission ID', 'Full name', 'Email address',
  'Instagram username', 'Snapchat username', 'TikTok username',
  'Content category', 'Why they want to represent us', 'Acknowledgment'
];

// Run once in the Apps Script editor to authorize access and prepare the tab.
function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    applicationSheet_();
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function doPost(event) {
  let application;
  try {
    application = validateApplication_(event);
  } catch (error) {
    return json_({ ok: false, code: 'INVALID_APPLICATION' });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, code: 'BUSY' });

  try {
    const sheet = applicationSheet_();
    const values = [
      application.name, application.email, application.instagram,
      application.snapchat, application.tiktok, application.category,
      application.why, 'Yes'
    ].map(sheetText_);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const match = sheet.getRange(2, 2, lastRow - 1, 1)
        .createTextFinder(application.submissionId)
        .matchEntireCell(true).useRegularExpression(false).findNext();
      if (match) {
        // A retry must match the same application, not just reuse its receipt.
        const saved = sheet.getRange(match.getRow(), 3, 1, values.length).getValues()[0];
        const normalized = values.map(value => value.startsWith("'") ? value.slice(1) : value);
        if (saved.some((value, index) => String(value) !== normalized[index] && String(value) !== values[index])) {
          return json_({ ok: false, code: 'RECEIPT_CONFLICT' });
        }
        return json_({ ok: true, submissionId: application.submissionId });
      }
    }

    // Plain-text cells and apostrophe escaping prevent applicant text becoming formulas.
    const row = sheet.getRange(lastRow + 1, 1, 1, HEADERS.length);
    row.setNumberFormat('@');
    row.setValues([[new Date().toISOString(), application.submissionId].concat(values)]);
    SpreadsheetApp.flush();
    return json_({ ok: true, submissionId: application.submissionId });
  } catch (error) {
    // Do not return private sheet details or applicant data in error responses.
    return json_({ ok: false, code: 'SAVE_FAILED' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  // This endpoint accepts applications only; it never returns saved applicants.
  return json_({ ok: true, service: 'Thompson Jewellers ambassador applications' });
}

function applicationSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(TAB_NAME) || spreadsheet.insertSheet(TAB_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (HEADERS.some((header, index) => headers[index] !== header)) {
      throw new Error('The application tab has unexpected column headings.');
    }
  }
  return sheet;
}

function validateApplication_(event) {
  if (!event || !event.parameter || !event.postData || event.postData.length > 60000) {
    throw new Error('Invalid request');
  }
  const parameters = event.parameter;
  const field = (name, max, required) => {
    if (event.parameters && event.parameters[name] && event.parameters[name].length !== 1) {
      throw new Error('Duplicate field');
    }
    const value = String(parameters[name] || '').trim();
    if ((required && !value) || value.length > max || value.includes('\u0000')) {
      throw new Error('Invalid field');
    }
    return value;
  };
  const application = {
    submissionId: field('submissionId', 32, true),
    name: field('name', 120, true),
    email: field('email', 254, true),
    instagram: field('instagram', 100, false),
    snapchat: field('snapchat', 100, false),
    tiktok: field('tiktok', 100, false),
    category: field('category', 30, true),
    why: field('why', 3000, true)
  };
  if (!/^[a-f0-9]{32}$/.test(application.submissionId) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email) ||
      !['Jewelry', 'Fashion', 'Lifestyle', 'Beauty', 'Other'].includes(application.category) ||
      field('consent', 3, true) !== 'yes' || field('website', 200, false)) {
    throw new Error('Invalid application');
  }
  return application;
}

function sheetText_(value) {
  return /^[\s]*[=+\-@']/.test(value) ? "'" + value : value;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
