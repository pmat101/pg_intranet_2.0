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

function handleBD01Asubmit(payload) {
  try {
    logger.log("Received payload: " + JSON.stringify(payload));
    const { pgCompany, stateCode, typeOfWork, sector, specs } = payload;
    const { pcode } = genProposalIDnPCODE(
      pgCompany,
      stateCode,
      typeOfWork,
      sector,
      specs,
    );
    const db = getDB();
    const sheet = db.getSheetByName("bd01a");
    const row = [
      new Date(),
      pcode,
      pgCompany,
      stateCode,
      typeOfWork,
      sector,
      specs,
    ];
    sheet.appendRow(row);
    const subSheet = db.getSheetByName("submissions");
    const subID = "SUB_" + Utilities.getUuid(); // 👈 Gives us a globally unique ID
    const snapshot = JSON.stringify(payload);
    const subRow = [
      subID,
      "BD01A", // 👈 Form code — we'll use this in registers
      pcode,
      sessionStorage.getActiveUser().getEmail(), // 👈 Captures the email of the user submitting the form
      new Date(),
      "submitted", // 👈 Status (later we can log drafts, rejected, etc.)
      snapshot, // 👈 Stores the entire payload frozen as a string)
    ];
    subSheet.appendRow(subRow);

    const subject = `New BD01A Submission: ${pcode}`;
    const body = `A new BD01A form has been submitted with the following details:\n\nProposal Code: ${pcode}\nCompany: ${pgCompany}\nState: ${stateCode}\nType of Work: ${typeOfWork}\nSector: ${sector}\nSpecs: ${specs}\n\nPlease review the submission in the spreadsheet.`;
    const recipients = "pranav.mathur@perfact.in";
    GmailApp.sendEmail(recipients, subject, body);

    return { pcode };
  } catch (err) {
    throw new Error("BD01A submission failed: " + err.message);
  }
}
