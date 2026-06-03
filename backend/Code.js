const SHEET_NAME = 'Data';
const SPREADSHEET_ID = '1MWlGS3gMx0Ahfl1iFDSyL7ajRH0zaz5xIRPKwqMfIck';
const OPTIONAL_API_KEY_PROPERTY = 'SCANNER_API_KEY';
const API_VERSION = '2026-06-03-7col';
const DATA_HEADERS = [
  'Timestamp',
  'Decoded QR text',
  'Candidate Code',
  'Class',
  'Session',
  'Name',
  'Remark',
];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (params.callback && params.decodedText) {
    return handleJsonpRecord_(params);
  }

  return jsonResponse_({
    ok: true,
    service: 'Pyramid Challenge QR Scanner API',
    version: API_VERSION,
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
  });
}

function doPost(e) {
  try {
    const data = parseRequest_(e);
    validateApiKey_(data.key);
    recordData(data.decodedText, data.remark);

    return jsonResponse_({
      ok: true,
      message: 'Recorded',
      version: API_VERSION,
    });
  } catch (error) {
    Logger.log('Error handling request: ' + error.message);

    return jsonResponse_({
      ok: false,
      message: error.message || 'Failed to record data. Please try again.',
    });
  }
}

function recordData(decodedText, remark) {
  try {
    if (!decodedText) {
      throw new Error('Missing decoded QR text.');
    }

    const sheet = getDataSheet_();
    ensureHeaderRowIfEmpty_(sheet);

    const student = parseStudentInfo_(decodedText);
    sheet.appendRow([
      new Date(),
      decodedText,
      student.code,
      student.className,
      student.session,
      student.name,
      remark || '',
    ]);
  } catch (error) {
    Logger.log('Error recording data: ' + error.message);
    throw error;
  }
}

function parseStudentInfo_(decodedText) {
  const text = String(decodedText || '').trim();
  const match = text.match(/^([A-Za-z0-9]+)-([A-Za-z0-9]+)\(([^)]+)\)\s*(.*)$/);

  if (!match) {
    return {
      className: '',
      code: text,
      session: '',
      name: '',
    };
  }

  return {
    className: match[1],
    code: match[2],
    session: match[3],
    name: match[4],
  };
}

function parseRequest_(e) {
  if (!e) {
    return {};
  }

  const contentType = (e.postData && e.postData.type) || '';

  if (contentType.indexOf('application/json') !== -1 && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }

  return e.parameter || {};
}

function handleJsonpRecord_(params) {
  const callback = String(params.callback || '').replace(/[^\w$.]/g, '');
  const response = {};

  try {
    validateApiKey_(params.key);
    recordData(params.decodedText, params.remark);
    response.ok = true;
    response.message = 'Recorded';
    response.version = API_VERSION;
  } catch (error) {
    response.ok = false;
    response.message = error.message || 'Failed to record data. Please try again.';
  }

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function migrateDataSheetColumns() {
  const sheet = getDataSheet_();
  const lastColumn = sheet.getLastColumn();

  if (lastColumn >= 2) {
    const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const locationColumnIndex = headerValues.findIndex(function(header) {
      const normalized = String(header || '').trim().toLowerCase();
      return normalized === 'location' || normalized === '位置';
    });

    if (locationColumnIndex !== -1) {
      sheet.deleteColumn(locationColumnIndex + 1);
    }
  }

  ensureHeaderRow_(sheet);

  return {
    ok: true,
    headers: DATA_HEADERS,
    sheetName: SHEET_NAME,
    spreadsheetId: SPREADSHEET_ID,
  };
}

function getDataSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('找不到名稱為「' + SHEET_NAME + '」的工作表，請檢查試算表內的分頁名稱。');
  }

  return sheet;
}

function ensureHeaderRow_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DATA_HEADERS);
    return;
  }

  sheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
}

function ensureHeaderRowIfEmpty_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DATA_HEADERS);
  }
}

function validateApiKey_(providedKey) {
  const expectedKey = PropertiesService.getScriptProperties().getProperty(OPTIONAL_API_KEY_PROPERTY);

  if (expectedKey && providedKey !== expectedKey) {
    throw new Error('Invalid scanner API key.');
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
