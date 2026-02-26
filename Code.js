function getDB() {
  const sheetID =
    PropertiesService.getScriptProperties().getProperty("DB_SHEET_ID"); // 👈 This fetches the DB_SHEET_ID value added in script properties
  const ss = SpreadsheetApp.openById(sheetID); // 👈 This opens the actual spreadsheet object using its ID
  return ss; // 👈 Return the spreadsheet so any other function can call getDB() to access it
}

function getNextProjectSerial() {
  const db = getDB();
  const sheet = db.getSheetByName("sequences");
  const data = sheet.getDataRange().getValues();
  const lock = LockService.getScriptLock(); // 👈 Ensures no two users access the counter at the same time
  lock.waitLock(10000); // 👈 Waits up to 10 seconds if another form is generating a code
  try {
    for (let i = 0; i < data.length; i++) {
      // 👈 Loop searches the sheet for the key "project_serial"
      if (data[i][0] === "project_serial") {
        // 👈 Once found, it reads the current value, increments the cell and returns the old value
        let current = parseInt(data[i][1], 10);
        sheet.getRange(i + 1, 2).setValue(current + 1);
        return current;
      }
    }
    throw new Error("project_serial not found in sequences sheet");
  } finally {
    // 👈 Ensures the lock is released even if an error occurs
    lock.releaseLock();
  }
}

function genProposalIDnPCODE(pgCompany, stateCode, typeOfWork, sector, specs) {
  const serial = getNextProjectSerial(); // 👈 Fetches and increments serial
  const finYear = new Date().getFullYear().toString().slice(-2); // 👈 Gets the last two digits of the current year
  const proposalID = `${pgCompany}${finYear}${stateCode}${serial}${typeOfWork}${sector}${specs}`;
  const pcode = `${pgCompany}${finYear}${stateCode}${serial}`;
  return { proposalID, pcode };
}
