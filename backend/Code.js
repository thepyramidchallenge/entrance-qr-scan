const SPREADSHEET_ID = '1MWlGS3gMx0Ahfl1iFDSyL7ajRH0zaz5xIRPKwqMfIck';
const OPTIONAL_API_KEY_PROPERTY = 'SCANNER_API_KEY';
const API_VERSION = '2026-06-03-data-schema-v4';
const SHEET_SCHEMA = {
  data: {
    sheetName: 'Data',
    columns: {
      timestamp: 'Timestamp',
      fullData: 'Full data',
      scannedData: 'Scanned data',
      name: 'Name',
      remark: 'Remark',
      finalQRCode: 'Final_QRCode',
      manualInputData: 'Manual input data',
    },
  },
  studentInfo: {
    sheetName: 'Student info',
    columns: {
      qrCode: 'QRcode',
    },
    columnAliases: {
      qrCode: [
        'QRcode',
        'QR code',
        'QR Code',
        'QRCode',
        'QRcode data',
        'QR Code data',
        'Candidate Code',
        'Student Code',
        '考生編號',
      ],
    },
  },
  attendanceList: {
    sheetName: 'Attendance list',
    columns: {
      qrCode: 'QRcode',
    },
  },
};
const DATA_COLUMNS = SHEET_SCHEMA.data.columns;
const DATA_HEADERS = [
  DATA_COLUMNS.timestamp,
  DATA_COLUMNS.fullData,
  DATA_COLUMNS.scannedData,
  DATA_COLUMNS.name,
  DATA_COLUMNS.remark,
  DATA_COLUMNS.finalQRCode,
  DATA_COLUMNS.manualInputData,
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
    sheetName: SHEET_SCHEMA.data.sheetName,
  });
}

function doPost(e) {
  try {
    const data = parseRequest_(e);
    validateApiKey_(data.key);
    if (data.manualCode) {
      recordManualCode(data.manualCode, data.remark);
    } else {
      recordData(data.decodedText, data.remark);
    }

    return jsonResponse_({
      ok: true,
      message: data.manualCode ? '已成功登記🌟' : '已成功登記🌟',
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
    ensureDataHeaders_(sheet);

    const student = parseStudentInfo_(decodedText);
    appendMappedRow_(sheet, {
      [DATA_COLUMNS.timestamp]: new Date(),
      [DATA_COLUMNS.fullData]: String(decodedText || '').trim(),
      [DATA_COLUMNS.scannedData]: student.scannedData,
      [DATA_COLUMNS.name]: student.name,
      [DATA_COLUMNS.remark]: remark || '',
      [DATA_COLUMNS.finalQRCode]: student.scannedData,
      [DATA_COLUMNS.manualInputData]: '',
    });
  } catch (error) {
    Logger.log('Error recording data: ' + error.message);
    throw error;
  }
}

function recordManualCode(manualCode, remark) {
  const code = String(manualCode || '').trim();

  if (!code) {
    throw new Error('請輸入考生編號');
  }

  if (!isValidManualCode_(code)) {
    throw new Error('你輸入的考生編號格式錯誤');
  }

  const sheet = getDataSheet_();
  ensureDataHeaders_(sheet);
  appendMappedRow_(sheet, {
    [DATA_COLUMNS.timestamp]: new Date(),
    [DATA_COLUMNS.fullData]: code,
    [DATA_COLUMNS.scannedData]: '',
    [DATA_COLUMNS.name]: 'NA',
    [DATA_COLUMNS.remark]: remark || '',
    [DATA_COLUMNS.finalQRCode]: code,
    [DATA_COLUMNS.manualInputData]: code,
  });
}

function parseStudentInfo_(decodedText) {
  const text = String(decodedText || '').trim();
  const match = text.match(/^(\S+-\S+\([^)]*\))\s*(.*)$/);

  if (!match) {
    return {
      scannedData: text,
      name: 'NA',
    };
  }

  return {
    scannedData: match[1],
    name: String(match[2] || '').trim() || 'NA',
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
    recordManualCode(params.manualCode, params.remark);
    response.ok = true;
    response.message = '已成功登記🌟';
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
  const qrCodeColumn = getHeaderColumnIndex_(sheet, SHEET_SCHEMA.studentInfo.columnAliases.qrCode, false);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  if (!qrCodeColumn) {
    return sheetContainsExactValue_(sheet, code);
  }

  const values = sheet.getRange(2, qrCodeColumn, lastRow - 1, 1).getValues();

  return values.some(function(row) {
    return String(row[0] || '').trim() === code;
  });
}

function getQrCodeLookupSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SCHEMA.studentInfo.sheetName);

  if (!sheet) {
    throw new Error('找不到名稱為「' + SHEET_SCHEMA.studentInfo.sheetName + '」的工作表，請檢查試算表內的分頁名稱。');
  }

  return sheet;
}

function getHeaderColumnIndex_(sheet, headerNames, shouldThrow) {
  const lastColumn = sheet.getLastColumn();
  const candidates = Array.isArray(headerNames) ? headerNames : [headerNames];

  if (lastColumn < 1) {
    if (shouldThrow === false) {
      return 0;
    }
    throw new Error('找不到「' + candidates[0] + '」欄。');
  }

  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const headerIndex = headerValues.findIndex(function(header) {
    return candidates.some(function(candidate) {
      return normalizeHeader_(header) === normalizeHeader_(candidate);
    });
  });

  if (headerIndex === -1) {
    if (shouldThrow === false) {
      return 0;
    }
    throw new Error('找不到「' + candidates[0] + '」欄。');
  }

  return headerIndex + 1;
}

function sheetContainsExactValue_(sheet, value) {
  const normalizedValue = String(value || '').trim();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (!normalizedValue || lastRow < 2 || lastColumn < 1) {
    return false;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return values.some(function(row) {
    return row.some(function(cell) {
      return String(cell || '').trim() === normalizedValue;
    });
  });
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function migrateDataSheetColumns() {
  const sheet = getDataSheet_();
  const rows = sheet.getDataRange().getValues();
  const headerMap = rows.length ? buildHeaderMapFromValues_(rows[0]) : {};
  const migratedRows = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const timestamp = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.timestamp]);
    const fullData = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.fullData, 'Decoded QR text']) || getMappedRowValue_(row, headerMap, [DATA_COLUMNS.scannedData, 'QRcode data', 'Candidate Code']);
    const parsed = parseStudentInfo_(fullData);
    const existingName = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.name]);
    const remark = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.remark]);
    const scannedData = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.scannedData, 'QRcode data']);
    const finalQRCode = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.finalQRCode]);
    const manualInputData = getMappedRowValue_(row, headerMap, [DATA_COLUMNS.manualInputData]);

    if (!timestamp && !fullData && !existingName && !remark && !scannedData && !finalQRCode && !manualInputData) {
      continue;
    }

    const migratedScannedData = scannedData || parsed.scannedData || fullData || '';

    migratedRows.push([
      timestamp || '',
      fullData || '',
      migratedScannedData,
      parsed.name !== 'NA' ? parsed.name : (existingName || 'NA'),
      remark || '',
      finalQRCode || manualInputData || migratedScannedData,
      manualInputData || '',
    ]);
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);

  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, DATA_HEADERS.length).setValues(migratedRows);
  }

  trimDataSheetColumns_(sheet);

  return {
    ok: true,
    headers: DATA_HEADERS,
    sheetName: SHEET_SCHEMA.data.sheetName,
    spreadsheetId: SPREADSHEET_ID,
  };
}

function buildHeaderMapFromValues_(headers) {
  const map = {};

  headers.forEach(function(header, index) {
    const normalized = String(header || '').trim();
    if (normalized) {
      map[normalized] = index;
    }
  });

  return map;
}

function getMappedRowValue_(row, headerMap, headers) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    if (headerMap[header] !== undefined) {
      return row[headerMap[header]];
    }
  }

  return '';
}

function getDataSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SCHEMA.data.sheetName);

  if (!sheet) {
    throw new Error('找不到名稱為「' + SHEET_SCHEMA.data.sheetName + '」的工作表，請檢查試算表內的分頁名稱。');
  }

  return sheet;
}

function ensureDataHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DATA_HEADERS);
    return;
  }

  getHeaderMap_(sheet);
}

function appendMappedRow_(sheet, valuesByHeader) {
  const columnMap = getHeaderMap_(sheet);
  const lastColumn = sheet.getLastColumn();
  const row = new Array(lastColumn).fill('');

  DATA_HEADERS.forEach(function(header) {
    row[columnMap[header] - 1] = valuesByHeader[header] || '';
  });

  sheet.appendRow(row);
}

function keepDataColumns_(sheet) {
  ensureDataHeaders_(sheet);

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnsToDelete = [];

  currentHeaders.forEach(function(header, index) {
    if (DATA_HEADERS.indexOf(String(header || '').trim()) === -1) {
      columnsToDelete.push(index + 1);
    }
  });

  columnsToDelete.reverse().forEach(function(columnIndex) {
    sheet.deleteColumn(columnIndex);
  });

  ensureDataHeaders_(sheet);
  trimDataSheetColumns_(sheet);
}

function trimDataSheetColumns_(sheet) {
  const desiredColumns = DATA_HEADERS.length;
  const maxColumns = sheet.getMaxColumns();

  if (maxColumns > desiredColumns) {
    sheet.deleteColumns(desiredColumns + 1, maxColumns - desiredColumns);
  } else if (maxColumns < desiredColumns) {
    sheet.insertColumnsAfter(maxColumns, desiredColumns - maxColumns);
  }
}

function getHeaderMap_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    : [];
  const map = {};

  headers.forEach(function(header, index) {
    const normalized = String(header || '').trim();
    if (normalized) {
      map[normalized] = index + 1;
    }
  });

  DATA_HEADERS.forEach(function(header, index) {
    if (!map[header]) {
      const nextColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextColumn).setValue(header);
      map[header] = nextColumn;
    }
  });

  return map;
}

function getAttendanceListSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SCHEMA.attendanceList.sheetName);

  if (!sheet) {
    throw new Error('找不到名稱為「' + SHEET_SCHEMA.attendanceList.sheetName + '」的工作表，請檢查試算表內的分頁名稱。');
  }

  return sheet;
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
