const SHEET_NAME = 'Data';
const QR_CODE_LOOKUP_SHEET_NAME = '工作表7';
const QR_CODE_LOOKUP_HEADER = 'QRcode';
const SPREADSHEET_ID = '1MWlGS3gMx0Ahfl1iFDSyL7ajRH0zaz5xIRPKwqMfIck';
const OPTIONAL_API_KEY_PROPERTY = 'SCANNER_API_KEY';
const API_VERSION = '2026-06-03-manual-validation';
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

  if (params.callback && params.manualCode) {
    return handleJsonpManualRecord_(params);
  }

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
    if (data.manualCode) {
      recordManualCode(data.manualCode);
    } else {
      recordData(data.decodedText, data.remark);
    }

    return jsonResponse_({
      ok: true,
      message: data.manualCode ? '已成功紀錄' : 'Recorded',
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

function recordManualCode(manualCode) {
  const code = String(manualCode || '').trim();

  if (!code) {
    throw new Error('請輸入考生編號');
  }

  if (!isValidManualCode_(code)) {
    throw new Error('你輸入的考生編號格式錯誤');
  }

  recordData(code, '');
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

function handleJsonpManualRecord_(params) {
  const callback = String(params.callback || '').replace(/[^\w$.]/g, '');
  const response = {};

  try {
    validateApiKey_(params.key);
    recordManualCode(params.manualCode);
    response.ok = true;
    response.message = '已成功紀錄';
    response.version = API_VERSION;
  } catch (error) {
    response.ok = false;
    response.message = error.message || 'Failed to record data. Please try again.';
  }

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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

function isValidManualCode_(manualCode) {
  const code = String(manualCode || '').trim();
  const sheet = getQrCodeLookupSheet_();
  const qrCodeColumn = getHeaderColumnIndex_(sheet, QR_CODE_LOOKUP_HEADER);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const values = sheet.getRange(2, qrCodeColumn, lastRow - 1, 1).getValues();

  return values.some(function(row) {
    return String(row[0] || '').trim() === code;
  });
}

function getQrCodeLookupSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(QR_CODE_LOOKUP_SHEET_NAME);

  if (!sheet) {
    throw new Error('找不到名稱為「' + QR_CODE_LOOKUP_SHEET_NAME + '」的工作表，請檢查試算表內的分頁名稱。');
  }

  return sheet;
}

function getHeaderColumnIndex_(sheet, headerName) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error('找不到「' + headerName + '」欄。');
  }

  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const headerIndex = headerValues.findIndex(function(header) {
    return String(header || '').trim() === headerName;
  });

  if (headerIndex === -1) {
    throw new Error('找不到「' + headerName + '」欄。');
  }

  return headerIndex + 1;
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
