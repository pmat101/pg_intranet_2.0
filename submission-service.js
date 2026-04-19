function submitForm(formCode, payload) {
  if (formCode !== "WPF01") {
    throw new Error("Unsupported form: " + formCode);
  }
  return submitWPF01(payload);
}

function submitWPF01(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(500);

  try {
    const db = getDB();
    const now = new Date();
    const createdBy = Session.getActiveUser().getEmail() || "";
    const submissionId = Utilities.getUuid();

    payload = payload || {};
    payload.submission_id = submissionId;

    validateWPF01Server(payload);

    writeWPF01Main(db, payload, submissionId, createdBy, now);
    writeWPF01Lines(db, payload, submissionId, createdBy, now);

    appendSubmissionLedger(db, {
      submissionId: submissionId,
      formCode: "WPF01",
      pcode: firstPcodeFromWPF(payload),
      createdBy: createdBy,
      now: now,
      payload: payload,
    });

    appendAuditLog(db, {
      submissionId: submissionId,
      formCode: "WPF01",
      createdBy: createdBy,
      now: now,
      payload: payload,
    });

    sendWPF01Email(payload, submissionId);

    return {
      ok: true,
      submission_id: submissionId,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateWPF01Server(payload) {
  if (!payload.week_start) throw new Error("Week Start Date is missing.");
  if (!payload.week_end) throw new Error("Week End Date is missing.");
  if (!payload.team_name) throw new Error("Team Name is missing.");
  if (!payload.tf_filled) throw new Error("TFs filled this week is missing.");

  if (
    !Array.isArray(payload.weekly_team_info) ||
    payload.weekly_team_info.length === 0
  ) {
    throw new Error("Weekly Team Work Info must contain at least one row.");
  }

  if (
    !Array.isArray(payload.weekly_team_details) ||
    payload.weekly_team_details.length === 0
  ) {
    throw new Error("Weekly Team Work Details must contain at least one row.");
  }

  if (
    payload.tf_filled === "yes" &&
    (!Array.isArray(payload.tf_details) || payload.tf_details.length === 0)
  ) {
    throw new Error("TF rows are required when TFs filled this week is YES.");
  }

  if (
    payload.milestone_achieved === "yes" &&
    (!Array.isArray(payload.milestone_details) ||
      payload.milestone_details.length === 0)
  ) {
    throw new Error(
      "Milestone rows are required when Milestone achieved this week is YES.",
    );
  }

  validateRosterHoursServer(payload);
}

function validateRosterHoursServer(payload) {
  const roster = payload.weekly_team_info || [];
  const workRows = payload.weekly_team_details || [];

  const expectedByMember = {};
  roster.forEach(function (m) {
    if (!m.member_key) return;
    expectedByMember[m.member_key] = (parseFloat(m.working_days) || 0) * 8;
  });

  const actualByMember = {};
  workRows.forEach(function (r) {
    if (!r.member_key) return;
    actualByMember[r.member_key] =
      (actualByMember[r.member_key] || 0) + (parseFloat(r.time_spent) || 0);
  });

  const errors = [];
  Object.keys(expectedByMember).forEach(function (key) {
    const expected = Number(expectedByMember[key].toFixed(2));
    const actual = Number((actualByMember[key] || 0).toFixed(2));

    if (Math.abs(expected - actual) > 0.01) {
      const member = roster.find(function (r) {
        return r.member_key === key;
      });

      errors.push(
        (member?.name || "Member") +
          ": expected " +
          expected +
          " hours, got " +
          actual +
          " hours",
      );
    }
  });

  if (errors.length) {
    throw new Error(
      "Roster hours do not match work-detail hours:\n\n" + errors.join("\n"),
    );
  }
}

function writeWPF01Main(db, payload, submissionId, createdBy, now) {
  const sheet = db.getSheetByName("WPF01_main");
  if (!sheet) throw new Error("Missing sheet: WPF01_main");

  appendObjectRow(
    sheet,
    {
      week_start: payload.week_start || "",
      week_end: payload.week_end || "",
      team_name: payload.team_name || "",
      tf_filled: payload.tf_filled || "",
      milestone_achieved: payload.milestone_achieved || "",
      number_of_active_projects: payload.number_of_active_projects || "",
      targets_planned_this_week: payload.targets_planned_this_week || "",
      targets_achieved_this_week: payload.targets_achieved_this_week || "",
      highlights: payload.highlights || "",
      low_points_complaints: payload.low_points_complaints || "",
      challenges_faced: payload.challenges_faced || "",
      internal_bottlenecks: payload.internal_bottlenecks || "",
      external_bottlenecks: payload.external_bottlenecks || "",
      projected_targets_next_week: payload.projected_targets_next_week || "",
      total_working_hours: payload.total_working_hours || "",
    },
    {
      submissionId: submissionId,
      createdBy: createdBy,
      now: now,
    },
  );
}

function writeWPF01Lines(db, payload, submissionId, createdBy, now) {
  appendRowsFromArray(
    db.getSheetByName("WPF01_tf_details"),
    payload.tf_details || [],
    {
      submissionId: submissionId,
      createdBy: createdBy,
      now: now,
    },
  );

  appendRowsFromArray(
    db.getSheetByName("WPF01_milestone_details"),
    payload.milestone_details || [],
    {
      submissionId: submissionId,
      createdBy: createdBy,
      now: now,
    },
  );

  appendRowsFromArray(
    db.getSheetByName("WPF01_weekly_team_info"),
    payload.weekly_team_info || [],
    {
      submissionId: submissionId,
      createdBy: createdBy,
      now: now,
    },
  );

  appendRowsFromArray(
    db.getSheetByName("WPF01_weekly_team_details"),
    payload.weekly_team_details || [],
    {
      submissionId: submissionId,
      createdBy: createdBy,
      now: now,
    },
  );
}

function appendRowsFromArray(sheet, rows, meta) {
  if (!sheet || !rows.length) return;

  rows.forEach(function (obj, index) {
    appendObjectRow(sheet, obj, {
      submissionId: meta.submissionId,
      createdBy: meta.createdBy,
      now: meta.now,
      rowNo: index + 1,
    });
  });
}

function appendObjectRow(sheet, obj, meta) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(function (header) {
    const key = String(header || "").trim();

    if (!key) return "";
    if (key === "submission_id")
      return meta.submissionId || obj.submission_id || "";
    if (key === "created_at" || key === "timestamp")
      return meta.now || new Date();
    if (key === "created_by") return meta.createdBy || "";
    if (key === "row_no") return meta.rowNo || "";

    const value = obj[key];
    return value === undefined || value === null ? "" : value;
  });

  sheet.appendRow(row);
}

function appendSubmissionLedger(db, meta) {
  const sheet = db.getSheetByName("submissions");
  if (!sheet) throw new Error("Missing sheet: submissions");

  sheet.appendRow([
    meta.submissionId,
    meta.formCode,
    meta.pcode || "",
    meta.createdBy,
    meta.now,
    "submitted",
    JSON.stringify(meta.payload),
    "",
  ]);
}

function appendAuditLog(db, meta) {
  const sheet = db.getSheetByName("audit_log");
  if (!sheet) return;

  sheet.appendRow([
    meta.now,
    meta.createdBy,
    "submit",
    "WPF01",
    meta.submissionId,
    JSON.stringify(meta.payload),
  ]);
}

function firstPcodeFromWPF(payload) {
  const groups = [
    payload.weekly_team_details,
    payload.milestone_details,
    payload.tf_details,
  ];

  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const row of group) {
      if (row && row.pcode) return row.pcode;
    }
  }

  return "";
}

function submitBD01A(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const db = getDB();
    const sheet = db.getSheetByName("bd01a");
    if (!sheet) throw new Error("Missing sheet: bd01a");

    payload = payload || {};

    validateBD01AServer(payload);

    const now = new Date();
    const submissionId = Utilities.getUuid();
    const ids = genProposalIDnPCODE(payload);
    const proposalID = ids.proposalID;
    const pcode = ids.pcode;

    payload.submission_id = submissionId;
    payload.proposal_id = proposalID;
    payload.pcode = pcode;

    appendBD01ARow(sheet, payload, submissionId, proposalID, pcode, now);

    appendSubmissionLedger(db, {
      submissionId: submissionId,
      formCode: "BD01A",
      pcode: pcode,
      createdBy: payload.officialEmail || "",
      now: now,
      payload: payload,
    });

    appendAuditLog(db, {
      submissionId: submissionId,
      formCode: "BD01A",
      createdBy: payload.officialEmail || "",
      now: now,
      payload: payload,
    });

    sendBD01AEmail(payload, submissionId, proposalID, pcode);

    return {
      ok: true,
      submission_id: submissionId,
      proposalID: proposalID,
      pcode: pcode,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateBD01AServer(payload) {
  const required = [
    ["leadDate", "Date of Client's Mail/ Lead Generation"],
    ["formFillerFirstName", "Form filler first name"],
    ["formFillerLastName", "Form filler last name"],
    ["officialEmail", "Official Email ID"],
    ["customerCompany", "Customer's Company Legal Name"],
    ["customerContact", "Customer contact number"],
    ["customerEmail", "Customer Email"],
    ["customerEmailConfirm", "Confirm Email"],
    ["isRepeatCustomer", "Repeat customer yes/no"],
    ["activityProposed", "Type of Activity Proposed"],
    ["stUt", "ST/UT"],
    ["workType", "Type of Work"],
    ["specs", "Specifications"],
    ["finYear", "Financial Year"],
    ["pgCompany", "Perfact group company name"],
    ["customerClass", "Customer Classification"],
    ["leadSource", "Lead Source"],
  ];

  const missing = required
    .filter(([key]) => !String(payload[key] || "").trim())
    .map(([, label]) => label);

  if (
    payload.customerEmail &&
    payload.customerEmailConfirm &&
    String(payload.customerEmail).trim() !==
      String(payload.customerEmailConfirm).trim()
  ) {
    missing.push("Customer email and confirm email do not match");
  }

  if (missing.length) {
    throw new Error("Please fill: " + missing.join(", "));
  }
}

function appendBD01ARow(sheet, payload, submissionId, proposalID, pcode, now) {
  sheet.appendRow([
    submissionId,
    now,
    proposalID,
    pcode,
    payload.leadDate || "",
    payload.formFillerFirstName || "",
    payload.formFillerLastName || "",
    payload.officialEmail || "",
    payload.customerCompany || "",
    payload.customerFirstName || "",
    payload.customerLastName || "",
    payload.customerContact || "",
    payload.customerEmail || "",
    payload.customerEmailConfirm || "",
    payload.isRepeatCustomer || "",
    payload.activityProposed || "",
    payload.village || "",
    payload.taluka || "",
    payload.district || "",
    payload.state || "",
    payload.postalCode || "",
    payload.country || "",
    payload.stUt || "",
    payload.workType || "",
    payload.sector || "",
    payload.specs || "",
    payload.finYear || "",
    payload.pgCompany || "",
    payload.customerClass || "",
    payload.leadSource || "",
    payload.rfqUrl || "",
    payload.remarks || "",
  ]);
}
