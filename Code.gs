const SHEET_NAME = 'Old Form';
const COL_LETTER = 'E'; // column E
const START_ROW = 2;

function doGet(e) {
  const key = (e && e.parameter && e.parameter.key) ? String(e.parameter.key) : '';
  const expected = PropertiesService.getScriptProperties().getProperty('VENDOR_API_KEY') || '';
  if (!expected || key !== expected) return jsonOut({ error: 'unauthorized' }, 401);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return jsonOut({ error: 'sheet_not_found', SHEET_NAME }, 400);

  const lastRow = sheet.getLastRow();
  if (lastRow < START_ROW) return jsonOut({ vendors: [] });

  const rangeA1 = `${COL_LETTER}${START_ROW}:${COL_LETTER}${lastRow}`;
  const values = sheet.getRange(rangeA1).getValues().flat();

  const seen = new Set();
  const vendors = [];
  for (const v of values) {
    const s = String(v || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    vendors.push(s);
  }
  vendors.sort((a, b) => a.localeCompare(b));

  return jsonOut({ vendors });
}

function jsonOut(obj, code) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (code) out.setHttpStatusCode(code);
  return out;
}
