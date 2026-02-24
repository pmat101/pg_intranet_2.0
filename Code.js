function getDB() {
  const sheetId =
    PropertiesService.getScriptProperties().getProperty("DB_SHEET_ID");
  const ss = SpreadsheetApp.openById(sheetId);
  return ss;
}
/*
     → Reads the DB_SHEET_ID in the project properties. Keeps config out of code.
     → Opens the spreadsheet object so we can manipulate sheets.
     → Returns the Spreadsheet object to calling functions.
*/

function getProjectByPcode(pcode) {
  if (!pcode) return null; // → If empty, don’t waste time reading sheet

  const db = getDB();
  const sheet = db.getSheetByName("projects"); // → Reads master project sheet
  const data = sheet.getDataRange().getValues(); // → Returns 2D array of entire sheet

  const headers = data[0]; // → First row is column names
  const rows = data.slice(1); // → Everything except header

  const match = rows.find((r) => r[0] === pcode); // assuming pcode is first column

  if (!match) return null;

  const result = {};
  headers.forEach((h, i) => {
    result[h] = match[i]; // → Converts row array into object
  });

  return result;
}
