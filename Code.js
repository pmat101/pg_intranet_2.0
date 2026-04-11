function getDB() {
  const sheetID =
    PropertiesService.getScriptProperties().getProperty("DB_SHEET_ID"); // 👈 This fetches the DB_SHEET_ID value added in script properties
  const ss = SpreadsheetApp.openById(sheetID); // 👈 This opens the actual spreadsheet object using its ID
  return ss; // 👈 Return the spreadsheet so any other function can call getDB() to access it
}

function doGet(e) {
  const page =
    e && e.parameter && e.parameter.page ? e.parameter.page : "index"; // Reads ?page= from the URL (SAFETY: allow only known pages)
  const template = HtmlService.createTemplateFromFile(page);
  template.scriptURL = ScriptApp.getService().getUrl();
  return template
    .evaluate()
    .setTitle("PG Intranet")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Lets us embed the page inside Google Sites iframe
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

function submitForm(formCode, payload) {
  const db = getDB();
  const sheet = db.getSheetByName("bd01a");
  const ids = genProposalIDnPCODE(payload);
  const proposalID = ids.proposalID;
  const pcode = ids.pcode;
  const row = [
    new Date(),
    proposalID,
    pcode,
    payload.leadDate,
    payload.formFillerFirstName,
    payload.formFillerLastName,
    payload.officialEmail,
    payload.customerCompany,
    payload.customerFirstName,
    payload.customerLastName,
    payload.customerContact,
    payload.customerEmail,
    payload.isRepeatCustomer,
    payload.activityProposed,
    payload.village,
    payload.taluka,
    payload.district,
    payload.state,
    payload.postalCode,
    payload.country,
    payload.stUt,
    payload.workType,
    payload.sector,
    payload.specs,
    payload.finYear,
    payload.pgCompany,
    payload.customerClass,
    payload.leadSource,
    payload.rfq,
    payload.remarks,
  ]; // AppScript inserts rows using arrays. Each item becomes a column
  sheet.appendRow(row); // Adds the row to the bottom of the sheet
  sendFormEmail(formCode, payload);
  return {
    status: "success",
  };
}

function getTeamActiveProjects(teamName) {
  const db = SpreadsheetApp.openById(
    "17K8tBcEUhaAeoM0bVZxxxMrS1q0gg-4-m64XQanpI6s",
  );
  const sheet = db.getSheetByName("Active - With Timelines");
  if (!sheet) throw new Error("Missing sheet: Active - With Timelines");
  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const pcode = row[1]; // column B
    const projectName = row[2]; // column C
    const team = row[6]; // column G

    if (
      teamName &&
      String(team).trim() === String(teamName).trim() &&
      pcode &&
      projectName
    ) {
      rows.push({
        pcode: pcode,
        project_name: projectName,
      });
    }
  }

  return rows;
}
