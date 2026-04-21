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

function submitBD02(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const db = getDB();
    const sheet = db.getSheetByName("BD02");
    if (!sheet) throw new Error("Missing sheet: BD02");

    payload = payload || {};
    validateBD02Server(payload);

    const now = new Date();
    const submissionId = Utilities.getUuid();

    payload.submission_id = submissionId;

    appendBD02Row(sheet, payload, submissionId, now);

    appendSubmissionLedger(db, {
      submissionId: submissionId,
      formCode: "BD02",
      pcode: payload.pcode || "",
      createdBy: payload.officialEmail || "",
      now: now,
      payload: payload,
    });

    appendAuditLog(db, {
      submissionId: submissionId,
      formCode: "BD02",
      createdBy: payload.officialEmail || "",
      now: now,
      payload: payload,
    });

    sendBD02Email(payload, submissionId);

    return {
      ok: true,
      submission_id: submissionId,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateBD02Server(payload) {
  const required = [
    ["leadDate", "Date of Client's Mail/ Lead Generation"],
    ["officialEmail", "Official Email ID"],
    ["customerCompany", "Customer's Company Legal Name"],
    ["projectName", "Project Name"],
    ["projectLocation", "Project Location"],
    ["pcode", "P CODE"],
    ["salesOrderLink", "Link to sales order"],
    ["costComputerLink", "Link to Cost Computer"],
    ["finalProposalLink", "Link to final proposal"],
  ];

  const missing = required
    .filter(([key]) => !String(payload[key] || "").trim())
    .map(([, label]) => label);

  if (
    String(payload.gstAvailable || "").toUpperCase() === "YES" &&
    !String(payload.gstNumber || "").trim()
  ) {
    missing.push("GST number");
  }

  if (
    String(payload.panAvailable || "").toUpperCase() === "YES" &&
    !String(payload.panNumber || "").trim()
  ) {
    missing.push("PAN number");
  }

  if (
    String(payload.tanAvailable || "").toUpperCase() === "YES" &&
    !String(payload.tanNumber || "").trim()
  ) {
    missing.push("TAN number");
  }

  if (missing.length) {
    throw new Error("Please fill: " + missing.join(", "));
  }
}

function appendBD02Row(sheet, payload, submissionId, now) {
  function num(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    const n = Number(s);
    return Number.isFinite(n) ? n : "";
  }

  sheet.appendRow([
    submissionId,
    now,
    payload.leadDate || "",
    payload.formFillerFirstName || "",
    payload.formFillerLastName || "",
    payload.officialEmail || "",
    payload.customerCompany || "",
    payload.customerFirstName || "",
    payload.customerLastName || "",
    payload.customerContactCode || "",
    payload.customerContactNumber || "",
    payload.customerEmail || "",
    payload.gstAvailable || "",
    payload.gstNumber || "",
    payload.panAvailable || "",
    payload.panNumber || "",
    payload.tanAvailable || "",
    payload.tanNumber || "",
    payload.projectName || "",
    payload.projectLocation || "",
    payload.proposalId || "",
    payload.pcode || "",
    payload.dateProposalSent || "",
    payload.gstTreatment || "",
    payload.proposalTrendsSummaryLink || "",
    payload.dateProposalWon || "",
    payload.workOrderLink || "",
    payload.salesOrderLink || "",
    payload.costComputerLink || "",
    payload.finalProposalLink || "",
    payload.prR || "",
    payload.prB || "",
    payload.travellingExpensesInScope || "",
    num(payload.overheadCosts),
    num(payload.testingCharges),
    num(payload.adminExpenses),
    num(payload.manpowerCosts),
    num(payload.outsourcingCosts),
    num(payload.commissions),
    num(payload.outsourcedManpower),
    num(payload.secondaryDataCosts),
    num(payload.contingencyCosts),
    num(payload.siteVisitCosts),
    num(payload.projectBaseLevelCost),
    num(payload.finalQuoteValue),
    num(payload.percentageMargin),
    payload.prMode || "",
    payload.remarks || "",
  ]);
}

function submitBD03(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const db = getDB();
    const now = new Date();
    payload = payload || {};

    validateBD03Server(payload);

    const submissionId = Utilities.getUuid();
    payload.submission_id = submissionId;

    const mainSheet = db.getSheetByName("BD03_main");
    if (!mainSheet) throw new Error("Missing sheet: BD03_main");

    appendObjectRow(mainSheet, payload, {
      submissionId: submissionId,
      createdBy: payload.official_email || "",
      now: now,
    });

    appendRowsFromArray(
      db.getSheetByName("BD03_other_persons"),
      payload.other_persons || [],
      {
        submissionId: submissionId,
        createdBy: payload.official_email || "",
        now: now,
      },
    );

    appendRowsFromArray(
      db.getSheetByName("BD03_milestones"),
      payload.milestones || [],
      {
        submissionId: submissionId,
        createdBy: payload.official_email || "",
        now: now,
      },
    );

    appendSubmissionLedger(db, {
      submissionId: submissionId,
      formCode: "BD03",
      pcode: payload.pcode || "",
      createdBy: payload.official_email || "",
      now: now,
      payload: payload,
    });

    appendAuditLog(db, {
      submissionId: submissionId,
      formCode: "BD03",
      createdBy: payload.official_email || "",
      now: now,
      payload: payload,
    });

    sendBD03Email(payload, submissionId);

    return {
      ok: true,
      submission_id: submissionId,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateBD03Server(payload) {
  const required = [
    ["lead_date", "Date of Client's Mail/ Lead Generation"],
    ["official_email", "Official Email ID"],
    ["team_name", "Team Name"],
    ["team_head_email", "Team Head Email ID"],
    ["csuite_officer_email", "C-Suite Officer Email ID"],
    ["eia_coordinator_email", "EIA Coordinator Email"],
    ["customer_company", "Customer's Company Legal Name"],
    ["client_first_name", "Client First Name"],
    ["client_last_name", "Client Last Name"],
    ["client_contact_code", "Client Contact Code"],
    ["client_contact_number", "Client Contact Number"],
    ["client_email", "Client Email"],
    ["project_name", "Project Name"],
    ["pcode", "PCode"],
    ["scope_of_work", "Scope of Work"],
    ["category", "Category"],
    ["service_type_code_nabet_sector", "Service Type/ Code/ NABET Sector"],
    ["baseline_season", "Baseline Season"],
    ["eac_name", "EAC Name"],
    ["pg_company", "Perfact Group company name"],
  ];

  const missing = required
    .filter(([key]) => !String(payload[key] || "").trim())
    .map(([, label]) => label);

  if (
    String(payload.type_of_work || "").toLowerCase() === "other" &&
    !String(payload.type_of_work_other_specify || "").trim()
  ) {
    missing.push("Type of Work specify");
  }

  if (
    String(payload.category || "").toLowerCase() === "others" &&
    !String(payload.category_other_specify || "").trim()
  ) {
    missing.push("Category specify");
  }

  if (
    String(payload.service_type_code_nabet_sector || "").toLowerCase() ===
      "others" &&
    !String(payload.sector_other_specify || "").trim()
  ) {
    missing.push("Sector specify");
  }

  if (
    String(payload.baseline_season || "").toLowerCase() === "others" &&
    !String(payload.baseline_season_other_specify || "").trim()
  ) {
    missing.push("Season specify");
  }

  if (
    String(payload.eac_name || "").toLowerCase() === "others" &&
    !String(payload.eac_name_other_specify || "").trim()
  ) {
    missing.push("EAC specify");
  }

  if (
    String(payload.pg_company || "").toLowerCase() === "others" &&
    !String(payload.pg_company_other_specify || "").trim()
  ) {
    missing.push("PG company specify");
  }

  if (
    String(payload.travelling_borne_by || "").toLowerCase() === "other" &&
    !String(payload.travelling_borne_by_other_specify || "").trim()
  ) {
    missing.push("Travelling specify");
  }

  if (missing.length) {
    throw new Error("Please fill: " + missing.join(", "));
  }
}

function submitTF02(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const db = getDB();
    const sheet = db.getSheetByName("tf02_main");
    if (!sheet) throw new Error("Missing sheet: tf02_main");

    payload = payload || {};
    validateTF02(payload);

    const now = new Date();
    const submissionId = Utilities.getUuid();
    payload.submission_id = submissionId;

    appendTF02Row(sheet, payload, submissionId, now);

    appendSubmissionLedger(db, {
      submissionId: submissionId,
      formCode: "TF02",
      pcode: payload.pcode || "",
      createdBy: payload.employee_email || "",
      now: now,
      payload: payload,
    });

    appendAuditLog(db, {
      submissionId: submissionId,
      formCode: "TF02",
      createdBy: payload.employee_email || "",
      now: now,
      payload: payload,
    });

    sendTF02Email(payload, submissionId);

    return {
      ok: true,
      submission_id: submissionId,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateTF02(p) {
  const required = [
    ["date", "Date"],
    ["employee_email", "Employee Email ID"],
    ["team_name", "Team Name"],
    ["eia_coordinator_name", "EIA Coordinator Name"],
    ["committee_name", "Name of the Committee"],
    ["agenda_number", "Agenda Number"],
    ["project_name", "Project Name"],
    ["meeting_type", "Type of Meeting"],
    ["proposal_number", "Proposal Number"],
    ["pcode", "Project Code"],
    ["meeting_date", "Date of Meeting"],
    ["key_points_queries", "Key Points & Queries Raised by EAC"],
    ["eac_future_focus", "EAC’s Future Focus / Issues"],
    ["fae_suggestions", "Suggestions on FAE Reports"],
    ["ppt_changes", "Change in PPT Format"],
    ["immediate_actions", "Immediate Actions Required"],
    ["post_submittal_points", "Post-Submittals Related Points"],
    ["key_learnings", "Key Learnings for Team & FAEs"],
    ["struggles_and_reason", "Points We Struggled In & Reason"],
    ["future_implications", "Implications for Future Projects"],
    ["case_recommended", "Case Recommended"],
    ["warning_signs", "Warning Signs"],
    ["meeting_recording_link", "Meeting Recording Link"],
    ["final_presentation_link", "Final Presentation Link"],
  ];

  const missing = required
    .filter(([key]) => !String(p[key] || "").trim())
    .map(([, label]) => label);

  if (
    String(p.meeting_type || "").toLowerCase() === "others" &&
    !String(p.meeting_type_other || "").trim()
  ) {
    missing.push("Please specify for Type of Meeting");
  }

  if (
    String(p.case_recommended || "").toLowerCase() === "others" &&
    !String(p.case_recommended_other || "").trim()
  ) {
    missing.push("Please specify for Case Recommended");
  }

  if (!String(p.qcc_reviewers || "").trim()) {
    missing.push("QCC Reviewer Name");
  }

  if (missing.length) {
    throw new Error("Please fill: " + missing.join(", "));
  }
}

function appendTF02Row(sheet, p, submissionId, now) {
  sheet.appendRow([
    submissionId,
    now,
    p.date || "",
    p.first_name || "",
    p.last_name || "",
    p.employee_email || "",
    p.team_name || "",
    p.eia_coordinator_name || "",
    p.qcc_reviewers || "",
    p.committee_name || "",
    p.agenda_number || "",
    p.project_name || "",
    p.proposed_project_cost || "",
    p.existing_project_cost || "",
    p.case_type || "",
    p.meeting_type || "",
    p.meeting_type_other || "",
    p.proposal_number || "",
    p.pcode || "",
    p.meeting_date || "",
    p.meeting_time || "",
    p.perfact_officials || "",
    p.project_proponent || "",
    p.presenter_first_name || "",
    p.presenter_last_name || "",
    p.key_points_queries || "",
    p.eac_future_focus || "",
    p.fae_suggestions || "",
    p.ppt_changes || "",
    p.immediate_actions || "",
    p.post_submittal_points || "",
    p.key_learnings || "",
    p.struggles_and_reason || "",
    p.future_implications || "",
    p.feedback_suggestions || "",
    p.reply_to_be_submitted || "",
    p.case_recommended || "",
    p.case_recommended_other || "",
    p.warning_signs || "",
    p.action_points || "",
    p.meeting_recording_link || "",
    p.final_presentation_link || "",
    p.remarks || "",
  ]);
}
