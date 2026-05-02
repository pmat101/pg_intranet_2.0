function submitWPF01(payload) {
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
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
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
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
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
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
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
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateBD03Server(payload) {
  const required = [
    ["lead_date", "Date of Client's Mail/ Lead Generation"],
    ["official_email", "Official Email ID"],
    ["team", "Team Name"],
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
  const db = getDB();
  const sheet = db.getSheetByName("TF02");
  if (!sheet) throw new Error("Missing sheet: TF02");

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
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
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

function submitWPF03(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;
  payload.team_name = "Fountain";

  validateWPF03Server(payload);

  writeWPF03Main(db, payload, submissionId, now);
  writeWPF03AnalysisRows(db, payload, submissionId, now);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "WPF03",
    pcode: "",
    createdBy: payload.created_by || payload.team_name || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "WPF03",
    createdBy: payload.created_by || payload.team_name || "",
    now: now,
    payload: payload,
  });

  sendWPF03Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateWPF03Server(payload) {
  if (!payload.week_start_date) throw new Error("Week Start Date is missing.");
  if (!payload.week_end_date) throw new Error("Week End Date is missing.");
  if (
    !payload.analysis_rows ||
    !Array.isArray(payload.analysis_rows) ||
    payload.analysis_rows.length === 0
  ) {
    throw new Error("Analysis rows are required.");
  }

  const missingRows = [];
  payload.analysis_rows.forEach(function (r, idx) {
    if (!String(r.analysis_item || "").trim())
      missingRows.push(`Analysis row ${idx + 1}: item`);
    if (
      r.planned_last_week === "" ||
      r.planned_last_week === null ||
      r.planned_last_week === undefined
    ) {
      missingRows.push(`Analysis row ${idx + 1}: planned last week`);
    }
    if (
      r.achieving_this_week === "" ||
      r.achieving_this_week === null ||
      r.achieving_this_week === undefined
    ) {
      missingRows.push(`Analysis row ${idx + 1}: achieving this week`);
    }
    if (
      r.plan_for_next_week === "" ||
      r.plan_for_next_week === null ||
      r.plan_for_next_week === undefined
    ) {
      missingRows.push(`Analysis row ${idx + 1}: plan for next week`);
    }
  });

  if (missingRows.length) {
    throw new Error(
      "Please fill all analysis fields:\n\n" + missingRows.join("\n"),
    );
  }
}

function writeWPF03Main(db, payload, submissionId, now) {
  const sheet = db.getSheetByName("WPF03_main");
  if (!sheet) throw new Error("Missing sheet: WPF03_main");

  appendObjectRow(
    sheet,
    {
      week_start_date: payload.week_start_date || "",
      week_end_date: payload.week_end_date || "",
      team_name: payload.team_name || "",
      test_reports_issued: payload.test_reports_issued || "",
      test_reports_planned: payload.test_reports_planned || "",
      monitorings_completed: payload.monitorings_completed || "",
      monitorings_planned: payload.monitorings_planned || "",
      data_review_priority: payload.data_review_priority || "",
      highlights: payload.highlights || "",
      low_points: payload.low_points || "",
      challenges_faced: payload.challenges_faced || "",
      projected_targets_next_week: payload.projected_targets_next_week || "",
      weekly_ppt_link: payload.weekly_ppt_link || "",
      remarks: payload.remarks || "",
    },
    {
      submissionId: submissionId,
      createdBy: payload.created_by || payload.team_name || "",
      now: now,
    },
  );
}

function writeWPF03AnalysisRows(db, payload, submissionId, now) {
  appendRowsFromArray(
    db.getSheetByName("WPF03_analysis"),
    payload.analysis_rows || [],
    {
      submissionId: submissionId,
      createdBy: payload.created_by || payload.team_name || "",
      now: now,
    },
  );
}

function submitTF01(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF01(payload);

  writeTF01Main(db, payload, submissionId, now);
  writeTF01ProjectRows(db, payload, submissionId, now);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF01",
    pcode: firstPcodeFromTF01(payload),
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF01",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF01Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
  };
}

function validateTF01(payload) {
  const missing = [];

  if (!String(payload.date || "").trim()) missing.push("Date");
  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");

  const rows = Array.isArray(payload.project_details)
    ? payload.project_details
    : [];
  if (!rows.length) missing.push("PROJECT(S) DETAILS");

  rows.forEach(function (r, idx) {
    if (!String(r.project_name || "").trim())
      missing.push(`Project row ${idx + 1}: Project Name`);
    if (!String(r.pcode || "").trim())
      missing.push(`Project row ${idx + 1}: PCODE`);
    if (!String(r.pp_name || "").trim())
      missing.push(`Project row ${idx + 1}: PP Name`);
    if (!String(r.report_name || "").trim())
      missing.push(`Project row ${idx + 1}: Report Name`);
    if (!String(r.purpose_of_printing || "").trim())
      missing.push(`Project row ${idx + 1}: Purpose of Printing`);
    if (!String(r.pdf_link || "").trim())
      missing.push(`Project row ${idx + 1}: PDF Link`);
    if (
      r.no_of_pages === "" ||
      r.no_of_pages === null ||
      r.no_of_pages === undefined
    ) {
      missing.push(`Project row ${idx + 1}: No. of Pages`);
    }
    if (!String(r.type_of_print || "").trim())
      missing.push(`Project row ${idx + 1}: Type of Print`);
    if (
      r.no_of_copies === "" ||
      r.no_of_copies === null ||
      r.no_of_copies === undefined
    ) {
      missing.push(`Project row ${idx + 1}: No. of Copies`);
    }
  });

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function writeTF01Main(db, payload, submissionId, now) {
  const sheet = db.getSheetByName("TF01_main");
  if (!sheet) throw new Error("Missing sheet: TF01_main");

  appendObjectRow(
    sheet,
    {
      date: payload.date || "",
      employee_first_name: payload.employee_first_name || "",
      employee_last_name: payload.employee_last_name || "",
      employee_email: payload.employee_email || "",
      team_name: payload.team_name || "",
      remarks: payload.remarks || "",
    },
    {
      submissionId: submissionId,
      createdBy: payload.employee_email || "",
      now: now,
    },
  );
}

function writeTF01ProjectRows(db, payload, submissionId, now) {
  appendRowsFromArray(
    db.getSheetByName("tf01_project_details"),
    payload.project_details || [],
    {
      submissionId: submissionId,
      createdBy: payload.employee_email || "",
      now: now,
    },
  );
}

function firstPcodeFromTF01(payload) {
  const rows = payload.project_details || [];
  for (const r of rows) {
    if (r && r.pcode) return r.pcode;
  }
  return "";
}

function submitTF22(payload) {
  const db = getDB();
  const sheet = db.getSheetByName("TF22");
  if (!sheet) throw new Error("Missing sheet: TF22");

  payload = payload || {};
  validateTF22(payload);

  const now = new Date();
  const submissionId = Utilities.getUuid();

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.employee_first_name || "",
    payload.employee_last_name || "",
    payload.employee_email || "",
    payload.team_name || "",
    payload.type_of_work || "",
    payload.project_name || "",
    payload.date_of_completion || "",
    payload.project_code || "",
    payload.type_of_service || "",
    payload.attachments_url || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF22",
    pcode: payload.project_code || "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF22",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF22Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF22(payload) {
  const missing = [];

  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team");
  if (!String(payload.type_of_work || "").trim()) missing.push("Type of Work");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.date_of_completion || "").trim())
    missing.push("Date of completion of project");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.type_of_service || "").trim())
    missing.push("Type of Service");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF07(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF07(payload);

  const sheet = db.getSheetByName("TF07");
  if (!sheet) throw new Error("Missing sheet: TF07");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.employee_first_name || "",
    payload.employee_last_name || "",
    payload.employee_email || "",
    payload.team_name || "",
    payload.project_name || "",
    payload.project_code || "",
    payload.type_of_work || "",
    payload.type_of_work_other || "",
    payload.milestone_achieved || "",
    payload.milestone_achieved_other || "",
    payload.date_of_milestone_achieved || "",
    payload.proof_link || "",
    payload.submission_status || "",
    payload.person_to_bill || "",
    payload.email_of_person_to_bill || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF07",
    pcode: payload.project_code || "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF07",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF07Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF07(payload) {
  const missing = [];

  if (!String(payload.date || "").trim()) missing.push("Date");
  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.type_of_work || "").trim()) missing.push("Type of Work");
  if (!String(payload.milestone_achieved || "").trim())
    missing.push("Milestone Achieved");
  if (!String(payload.date_of_milestone_achieved || "").trim())
    missing.push("Date of Milestone achieved");
  if (!String(payload.proof_link || "").trim())
    missing.push("Link to Screenshot or Proof of Achieving Milestone");
  if (!String(payload.submission_status || "").trim())
    missing.push("Submission Status");
  if (!String(payload.person_to_bill || "").trim())
    missing.push("Person to Bill");
  if (!String(payload.email_of_person_to_bill || "").trim())
    missing.push("Email ID of Person to Bill");

  if (
    String(payload.type_of_work || "").toLowerCase() === "other" &&
    !String(payload.type_of_work_other || "").trim()
  ) {
    missing.push("Type of Work - other specify");
  }

  if (
    String(payload.milestone_achieved || "").toLowerCase() === "other" &&
    !String(payload.milestone_achieved_other || "").trim()
  ) {
    missing.push("Milestone Achieved - other specify");
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF05(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF05(payload);

  const sheet = db.getSheetByName("TF05");
  if (!sheet) throw new Error("Missing sheet: TF05");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.official_email || "",
    payload.team_name || "",
    payload.eia_coordinator_name || "",
    payload.qcc_reviewers || "",
    payload.presenter_first_name || "",
    payload.presenter_last_name || "",
    payload.presenter_email || "",
    payload.developer_company_name || "",
    payload.project_name || "",
    payload.project_proponent_first_name || "",
    payload.project_proponent_last_name || "",
    payload.project_code || "",
    payload.proposed_project_cost_lacs || "",
    payload.existing_project_cost_lacs || "",
    payload.project_cost_after_proposed_ec_lacs || "",
    payload.project_location || "",
    payload.plot_area_sq_m || "",
    payload.built_up_area_sq_m || "",
    payload.capacity || "",
    payload.emp_cost_capital_lacs || "",
    payload.category || "",
    payload.activity || "",
    payload.parivesh_login_id || "",
    payload.parivesh_password || "",
    payload.type_of_presentation || "",
    payload.type_of_presentation_other || "",
    payload.eac_committee || "",
    payload.proposal_no || "",
    payload.date_of_uploading || "",
    payload.agenda_no || "",
    payload.date_of_eac_meeting || "",
    payload.internal_meeting_link || "",
    payload.eac_meeting_link || "",
    payload.meeting_s_no || "",
    payload.master_ppt_link || "",
    payload.summarised_ppt_link || "",
    payload.brief_writeup_annexure || "",
    payload.uploading_document_single_file_link || "",
    payload.online_report_link || "",
    payload.undertaking_link || "",
    payload.kml_file_link || "",
    payload.backup_folder_link || "",
    payload.circulation_documents_link_docx || "",
    payload.circulation_documents_pdf || "",
    payload.critical_points || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF05",
    pcode: payload.project_code || "",
    createdBy: payload.official_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF05",
    createdBy: payload.official_email || "",
    now: now,
    payload: payload,
  });

  sendTF05Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF05(payload) {
  const missing = [];

  if (!String(payload.official_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.eia_coordinator_name || "").trim())
    missing.push("EIA Coordinator Name");
  if (!String(payload.presenter_email || "").trim())
    missing.push("Email ID of the person who will present in EAC/ SEAC");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.proposed_project_cost_lacs || "").trim())
    missing.push("Proposed Project Cost");
  if (!String(payload.project_location || "").trim())
    missing.push("Project Location");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.activity || "").trim()) missing.push("Activity");
  if (!String(payload.type_of_presentation || "").trim())
    missing.push("Type of Presentation");
  if (!String(payload.eac_committee || "").trim())
    missing.push("EAC Committee");
  if (!String(payload.proposal_no || "").trim()) missing.push("Proposal No.");
  if (!String(payload.agenda_no || "").trim()) missing.push("Agenda No.");
  if (!String(payload.internal_meeting_link || "").trim())
    missing.push("Internal Meeting Link");
  if (!String(payload.eac_meeting_link || "").trim())
    missing.push("EAC Meeting Link");
  if (!String(payload.master_ppt_link || "").trim())
    missing.push("Master PPT Link");
  if (!String(payload.summarised_ppt_link || "").trim())
    missing.push("Summarised PPT Link");
  if (!String(payload.uploading_document_single_file_link || "").trim())
    missing.push("Uploading Document - Single File Link");
  if (!String(payload.online_report_link || "").trim())
    missing.push("Online Report Link");
  if (!String(payload.undertaking_link || "").trim())
    missing.push("Undertaking Link");
  if (!String(payload.kml_file_link || "").trim())
    missing.push("KML File Link");
  if (!String(payload.backup_folder_link || "").trim())
    missing.push("Backup folder Link");
  if (!String(payload.circulation_documents_link_docx || "").trim())
    missing.push("Circulation Documents Link- in Docx");
  if (!String(payload.critical_points || "").trim())
    missing.push("Critical Points");

  if (
    String(payload.type_of_presentation || "").toLowerCase() === "other" &&
    !String(payload.type_of_presentation_other || "").trim()
  ) {
    missing.push("If Others, Pls Specify");
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF06(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF06(payload);

  const sheet = db.getSheetByName("TF06");
  if (!sheet) throw new Error("Missing sheet: TF06");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.official_email || "",
    payload.team_name || "",
    payload.eia_coordinator_name || "",
    payload.qcc_reviewers || "",
    payload.c_level_officer_name || "",
    payload.project_name || "",
    payload.project_proponent_first_name || "",
    payload.project_proponent_last_name || "",
    payload.project_code || "",
    payload.proposed_project_cost_lacs || "",
    payload.existing_project_cost_lacs || "",
    payload.project_cost_after_proposed_ec_lacs || "",
    payload.cer_budget_lacs || "",
    payload.project_location || "",
    payload.location_type || "",
    payload.plot_area_sq_m || "",
    payload.built_up_area_sq_m || "",
    payload.capacity || "",
    payload.kml_with_project_boundary_url || "",
    payload.emp_cost_capital_lacs || "",
    payload.emp_slides_url || "",
    payload.category || "",
    payload.activity || "",
    payload.major_sector || "",
    payload.minor_sector || "",
    payload.ph_applicable || "",
    payload.ph_mom_english_url || "",
    payload.ph_mom_local_language_url || "",
    payload.summary_of_ph_mom_url || "",
    payload.compliance_of_ph_url || "",
    payload.link_to_registration_details_pdf || "",
    payload.parivesh_login_details || "",
    payload.type_of_uploading || "",
    payload.type_of_uploading_other || "",
    payload.eac_committee || "",
    payload.proposal_no || "",
    payload.final_fae_list_url || "",
    payload.draft_form_i_part_a_pdf_url || "",
    payload.draft_form_i_part_a_docx_link || "",
    payload.draft_form_i_part_b_pdf_url || "",
    payload.draft_form_i_part_b_docx_link || "",
    payload.draft_form_i_part_c_pdf_url || "",
    payload.draft_form_i_part_c_docx_link || "",
    payload.life_cycle_assessment_pdf_url || "",
    payload.life_cycle_assessment_pptx_link || "",
    payload.wlcp_url || "",
    payload.distance_certification_url || "",
    payload.nbwl_url || "",
    payload.forest_clearance_url || "",
    payload.water_balance_pdf_url || "",
    payload.waste_tables_pdf_url || "",
    payload.process_emissions_pdf_url || "",
    payload.utility_emissions_pdf_url || "",
    payload.baseline_season || "",
    payload.baseline_location_maps_url || "",
    payload.master_ppt_pdf_url || "",
    payload.master_ppt_link || "",
    payload.cover_letter_pdf_url || "",
    payload.cover_letter_docx_link || "",
    payload.plans_annexure_pdf_url || "",
    payload.plans_annexure_docx_link || "",
    payload.annexure_pdf_url || "",
    payload.risk_assessment_pdf_url || "",
    payload.risk_assessment_docx_link || "",
    payload.signed_copy_initial_pages_url || "",
    payload.emp_eia_single_file_before_annexure_pdf_url || "",
    payload.emp_eia_single_file_before_annexure_docx_link || "",
    payload.conceptual_plan_pfr_pdf_url || "",
    payload.conceptual_plan_pfr_docx_link || "",
    payload.layout_pdf_url || "",
    payload.additional_files_pdf_url || "",
    payload.additional_files_docx_link || "",
    payload.board_resolution_pdf_url || "",
    payload.board_resolution_docx_link || "",
    payload.uploading_folder_pdf_link || "",
    payload.uploading_folder_docx_link || "",
    payload.single_file_pdf_url || "",
    payload.single_file_docx_link || "",
    payload.additional_critical_files_pdf_link || "",
    payload.additional_critical_files_docx_link || "",
    payload.authorisation_board_resolution_pdf_url || "",
    payload.authorisation_board_resolution_docx_link || "",
    payload.issues_in_uploading_or_pendency || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF06",
    pcode: payload.project_code || "",
    createdBy: payload.official_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF06",
    createdBy: payload.official_email || "",
    now: now,
    payload: payload,
  });

  sendTF06Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF06(payload) {
  const missing = [];

  if (!String(payload.official_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.eia_coordinator_name || "").trim())
    missing.push("EIA Coordinator Name");
  if (!String(payload.c_level_officer_name || "").trim())
    missing.push("C-Level Officer Name");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.ph_applicable || "").trim())
    missing.push("PH Applicable");
  if (!String(payload.type_of_uploading || "").trim())
    missing.push("Type of Uploading");
  if (!String(payload.eac_committee || "").trim())
    missing.push("EAC Committee");
  if (!String(payload.proposal_no || "").trim()) missing.push("Proposal No.");
  if (!String(payload.link_to_registration_details_pdf || "").trim())
    missing.push("Link to Registration Details - PDF");
  if (!String(payload.final_fae_list_url || "").trim())
    missing.push("Final FAE list");
  if (!String(payload.baseline_season || "").trim())
    missing.push("Baseline Season");
  if (!String(payload.master_ppt_link || "").trim())
    missing.push("Link to Master PPT");
  if (!String(payload.remarks || "").trim() && false) {
  } // keep optional

  if (
    String(payload.type_of_uploading || "").toLowerCase() === "others" &&
    !String(payload.type_of_uploading_other || "").trim()
  ) {
    missing.push("If Others, Pls Specify");
  }

  if (String(payload.ph_applicable || "").toLowerCase() === "yes") {
    [
      ["ph_mom_english_url", "PH MoM (english)"],
      ["ph_mom_local_language_url", "PH MoM (local language)"],
      ["summary_of_ph_mom_url", "Summary of PH MoM"],
      ["compliance_of_ph_url", "Compliance of PH"],
    ].forEach(function ([key, label]) {
      if (!String(payload[key] || "").trim()) missing.push(label);
    });
  }

  if (
    String(payload.type_of_uploading || "").toLowerCase() === "others" &&
    !String(payload.type_of_uploading_other || "").trim()
  ) {
    missing.push("If Others, Pls Specify");
  }

  [
    ["kml_with_project_boundary_url", "KML with project boundary"],
    ["emp_slides_url", "EMP Slides"],
    ["draft_form_i_part_a_pdf_url", "Draft Form-I (part A)- PDF"],
    ["draft_form_i_part_b_pdf_url", "Draft Form-I (part B)- PDF"],
    ["draft_form_i_part_c_pdf_url", "Draft Form-I (part C)- PDF"],
    ["life_cycle_assessment_pdf_url", "Life Cycle Assessment- PDF"],
    ["water_balance_pdf_url", "Water Balance- PDF"],
    [
      "waste_tables_pdf_url",
      "Hazardous waste, Non-hazardous waste and other waste tables- PDF",
    ],
    ["process_emissions_pdf_url", "Process emissions with APCM- PDF"],
    ["utility_emissions_pdf_url", "Utility emissions with APCM- PDF"],
    [
      "baseline_location_maps_url",
      "Baseline location Maps with sampling details",
    ],
    ["master_ppt_pdf_url", "Master PPT- PDF"],
    ["uploading_folder_pdf_link", "Link to Uploading Folder- PDF"],
    [
      "authorisation_board_resolution_pdf_url",
      "Authorisation of the Concerned person making application (Board resolution)- PDF",
    ],
  ].forEach(function ([key, label]) {
    if (!String(payload[key] || "").trim()) {
      // These are required in the source, so keep them mandatory
      missing.push(label);
    }
  });

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF25(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF25(payload);

  const sheet = db.getSheetByName("TF25");
  if (!sheet) throw new Error("Missing sheet: TF25");

  sheet.appendRow([
    submissionId,
    now,
    payload.employee_first_name || "",
    payload.employee_last_name || "",
    payload.employee_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.project_code || "",
    payload.parivesh_proposal_number || "",
    payload.type_of_case || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_seac || "",
    payload.eia_coordinator_name || "",
    payload.query_raised || "",
    payload.ads_screenshot_url || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF25",
    pcode: payload.project_code || "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF25",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF25Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF25(payload) {
  const missing = [];

  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.eia_coordinator_name || "").trim())
    missing.push("EIA Coordinator Name");
  if (!String(payload.query_raised || "").trim()) missing.push("Query Raised");
  if (!String(payload.eac_seac || "").trim()) missing.push("EAC/SEAC");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF24(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF24(payload);

  const sheet = db.getSheetByName("TF24");
  if (!sheet) throw new Error("Missing sheet: TF24");

  sheet.appendRow([
    submissionId,
    now,
    payload.employee_first_name || "",
    payload.employee_last_name || "",
    payload.employee_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.project_code || "",
    payload.parivesh_proposal_number || "",
    payload.type_of_case || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_seac || "",
    payload.eia_coordinator_name || "",
    payload.query_raised || "",
    payload.eds_screenshot_url || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF24",
    pcode: payload.project_code || "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF24",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF24Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF24(payload) {
  const missing = [];

  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.eia_coordinator_name || "").trim())
    missing.push("EIA Coordinator Name");
  if (!String(payload.query_raised || "").trim()) missing.push("Query Raised");
  if (!String(payload.eac_seac || "").trim()) missing.push("EAC/SEAC");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF16(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF16(payload);

  const sheet = db.getSheetByName("TF16");
  if (!sheet) throw new Error("Missing sheet: TF16");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.employee_first_name || "",
    payload.employee_last_name || "",
    payload.employee_email || "",
    payload.team_name || "",
    payload.project_name || "",
    payload.project_code || "",
    payload.agenda_number || "",
    payload.date_of_tf06_submission || "",
    payload.date_of_pfr_emp_eia_submission || "",
    payload.date_of_eds_raised || "",
    payload.date_of_eds_submitted || "",
    payload.date_of_project_enlistment || "",
    payload.meeting_datetime || "",
    payload.meeting_link || "",
    payload.critical_points || "",
    payload.potential_attendees_perfact || "",
    payload.potential_attendees_pp || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF16",
    pcode: payload.project_code || "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF16",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF16Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF16(payload) {
  const missing = [];

  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.project_code || "").trim()) missing.push("Project Code");
  if (!String(payload.agenda_number || "").trim())
    missing.push("Agenda Number");
  if (!String(payload.date_of_tf06_submission || "").trim())
    missing.push("Date of TF06 Submission");
  if (!String(payload.date_of_pfr_emp_eia_submission || "").trim())
    missing.push("Date of PFR/EMP/EIA Submission");
  if (!String(payload.date_of_project_enlistment || "").trim())
    missing.push("Date of Project Enlistment");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitHR01(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateHR01(payload);

  const sheet = db.getSheetByName("HR01");
  if (!sheet) throw new Error("Missing sheet: HR01");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.employee_email || "",
    payload.applicant_first_name || "",
    payload.applicant_last_name || "",
    payload.position_applied_for || "",
    payload.interview_date || "",
    payload.interviewer_first_name || "",
    payload.interviewer_last_name || "",
    payload.meeting_recording_link || "",
    payload.education_training || "",
    payload.technical_skills || "",
    payload.communication || "",
    payload.job_knowledge || "",
    payload.work_experience || "",
    payload.body_language || "",
    payload.attitude_towards_interview_job || "",
    payload.culture_compatibility || "",
    payload.interviewer_comments || "",
    payload.star_rating || "",
    payload.final_recommendation || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "HR01",
    pcode: "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "HR01",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendHR01Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateHR01(payload) {
  const missing = [];

  if (!String(payload.employee_email || "").trim())
    missing.push("Email of person filling the form");
  if (!String(payload.applicant_first_name || "").trim())
    missing.push("Applicant First Name");
  if (!String(payload.applicant_last_name || "").trim())
    missing.push("Applicant Last Name");
  if (!String(payload.position_applied_for || "").trim())
    missing.push("Position applied for");
  if (!String(payload.interview_date || "").trim())
    missing.push("InterviewDate");
  if (!String(payload.interviewer_first_name || "").trim())
    missing.push("Interviewer First Name");
  if (!String(payload.interviewer_last_name || "").trim())
    missing.push("Interviewer Last Name");
  if (!String(payload.final_recommendation || "").trim())
    missing.push("Final Recommendation");

  [
    ["education_training", "Education/Training"],
    ["technical_skills", "Technical Skills"],
    ["communication", "Communication"],
    ["job_knowledge", "Job Knowledge"],
    ["work_experience", "Work Experience"],
    ["body_language", "Body Language"],
    ["attitude_towards_interview_job", "Attitude towards Interview/Job"],
    ["culture_compatibility", "Culture Compatibility"],
    ["star_rating", "Star Rating"],
  ].forEach(function ([key, label]) {
    if (!String(payload[key] || "").trim()) missing.push(label);
  });

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitADM06(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateADM06(payload);

  const sheet = db.getSheetByName("ADM06");
  if (!sheet) throw new Error("Missing sheet: ADM06");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.purpose_of_hotspot_requirement || "",
    payload.hotspot_required_from_date || "",
    payload.hotspot_required_till_date || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "ADM06",
    pcode: "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "ADM06",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendADM06Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateADM06(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Requestor Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.purpose_of_hotspot_requirement || "").trim())
    missing.push("Purpose of Hotspot Requirement");
  if (!String(payload.hotspot_required_from_date || "").trim())
    missing.push("Hotspot required from date");
  if (!String(payload.hotspot_required_till_date || "").trim())
    missing.push("Hotspot required till date");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitADM04(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateADM04(payload);

  const sheet = db.getSheetByName("ADM04");
  if (!sheet) throw new Error("Missing sheet: ADM04");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.department || "",
    payload.team_name || "",
    payload.vehicle_detail || "",
    payload.type_of_work || "",
    payload.workshop || "",
    payload.date_of_last_service || "",
    payload.last_service_kms || "",
    payload.amount_incurred_last_periodic_service || "",
    payload.current_running_kms || "",
    payload.proposed_date_of_service || "",
    payload.puc_valid_till || "",
    payload.puc_to_be_renewed_on_or_before || "",
    payload.last_time_tyres_purchase_date || "",
    payload.cost_of_last_tyres_purchase || "",
    payload.proposed_date_of_new_tyres_purchase || "",
    payload.brand_of_tyres || "",
    payload.vendor_name_tyres || "",
    payload.warranty_of_tyres || "",
    payload.last_battery_purchase_date || "",
    payload.cost_of_last_purchase_battery || "",
    payload.buy_back_cost_of_exiting_old_battery || "",
    payload.cost_of_new_battery || "",
    payload.brand_of_battery || "",
    payload.warranty_of_battery || "",
    payload.vendor_name_battery || "",
    payload.insurance_valid_till || "",
    payload.current_insurance_provider || "",
    payload.last_insurance_premium_paid || "",
    payload.insurance_renewal_on_or_before || "",
    payload.details_of_emergency_repair_and_maintenance || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "ADM04",
    pcode: "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "ADM04",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendADM04Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateADM04(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim()) missing.push("Email");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.vehicle_detail || "").trim())
    missing.push("Vehicle Detail");
  if (!String(payload.type_of_work || "").trim())
    missing.push("Type of work to be done");

  const t = String(payload.type_of_work || "").toLowerCase();

  if (t === "periodic service") {
    [
      "workshop",
      "date_of_last_service",
      "last_service_kms",
      "amount_incurred_on_last_periodic_service",
      "current_running_kms",
      "proposed_date_of_service",
    ].forEach(function (key) {
      if (!String(payload[key] || "").trim()) missing.push(key);
    });
  }

  if (t === "puc renewal") {
    ["puc_valid_till", "puc_to_be_renewed_on_or_before"].forEach(
      function (key) {
        if (!String(payload[key] || "").trim()) missing.push(key);
      },
    );
  }

  if (t === "new tyres to be purchased") {
    [
      "last_time_tyres_purchase_date",
      "cost_of_last_tyres_purchase",
      "proposed_date_of_new_tyres_purchase",
      "brand_of_tyres",
      "vendor_name_tyres",
      "warranty_of_tyres",
    ].forEach(function (key) {
      if (!String(payload[key] || "").trim()) missing.push(key);
    });
  }

  if (t === "new battery required") {
    [
      "last_battery_purchase_date",
      "cost_of_last_purchase_battery",
      "buy_back_cost_of_exiting_old_battery",
      "cost_of_new_battery",
      "brand_of_battery",
      "warranty_of_battery",
      "vendor_name_battery",
    ].forEach(function (key) {
      if (!String(payload[key] || "").trim()) missing.push(key);
    });
  }

  if (t === "insurance renewal") {
    [
      "insurance_valid_till",
      "current_insurance_provider",
      "last_insurance_premium_paid",
      "insurance_renewal_on_or_before",
    ].forEach(function (key) {
      if (!String(payload[key] || "").trim()) missing.push(key);
    });
  }

  if (t === "emergency repair & maintenance work") {
    if (
      !String(payload.details_of_emergency_repair_and_maintenance || "").trim()
    ) {
      missing.push("Details of emergency repair and maintenance");
    }
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitADM03(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};

  validateADM03(payload);

  const mainSheet = db.getSheetByName("ADM03_main");
  const detailSheet = db.getSheetByName("ADM03_visit_details");

  if (!mainSheet) throw new Error("Missing sheet: ADM03_main");
  if (!detailSheet) throw new Error("Missing sheet: ADM03_visit_details");

  mainSheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.department || "",
    payload.remarks || "",
  ]);

  (payload.details || []).forEach(function (row, index) {
    detailSheet.appendRow([
      submissionId,
      index + 1,
      row.date_of_pickup || "",
      row.vehicle_required_till_date || "",
      row.name_of_person_going_for_visit || "",
      row.time_of_pickup_team || "",
      row.pickup_point || "",
      row.places_to_be_visited || "",
      row.project_name || "",
      row.pcode || "",
      row.distance_travelled || "",
      row.purpose_of_visit || "",
    ]);
  });

  sendADM03Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateADM03(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requester");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");

  if (!Array.isArray(payload.details) || !payload.details.length) {
    missing.push("At least one vehicle requirement row");
  } else {
    payload.details.forEach(function (row, i) {
      if (!String(row.project_name || "").trim())
        missing.push(`Project Name in row ${i + 1}`);
      if (!String(row.pcode || "").trim())
        missing.push(`PCODE in row ${i + 1}`);
      if (!String(row.distance_travelled || "").trim())
        missing.push(`Distance travelled in row ${i + 1}`);
    });
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ01(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ01(payload);

  const sheet = db.getSheetByName("FQ01");
  if (!sheet) throw new Error("Missing sheet: FQ01");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.aq_questionnaire_sheet_link || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ01",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ01",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ01Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ01(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.aq_questionnaire_sheet_link || "").trim())
    missing.push("AQ Questionnaire sheet link");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ02(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ02(payload);

  const sheet = db.getSheetByName("FQ02");
  if (!sheet) throw new Error("Missing sheet: FQ02");

  sheet.appendRow([
    submissionId,
    now,
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.eac_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.developed_by || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.baseline_season || "",
    payload.aq_dispersion_model_link || "",
    payload.remarks || "",
  ]);

  sendFQ02Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ02(payload) {
  const missing = [];

  if (!payload.requestor_email) missing.push("Official Email ID");
  if (!payload.team_name) missing.push("Team Name");
  if (!payload.pcode) missing.push("PCODE");
  if (!payload.aq_dispersion_model_link)
    missing.push("AQ Dispersion Model link");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ03(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ03(payload);

  const sheet = db.getSheetByName("FQ03");
  if (!sheet) throw new Error("Missing sheet: FQ03");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.type_of_project || "",
    payload.type_of_industry || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.total_land_area_m2 || "",
    payload.green_belt_area_m2 || "",
    payload.existing_storage_area_m2 || "",
    payload.proposed_storage_area_m2 || "",
    payload.manpower_details || "",
    payload.emp_report_url || "",
    payload.pfr_or_eia_report_url || "",
    payload.kml_file_url || "",
    payload.msds_safety_datasheet_url || "",
    payload.applicable_tor_details_url || "",
    payload.manufacturing_process_details_url || "",
    payload.process_flow_charts_pid_url || "",
    payload.ec_url || "",
    payload.cte_url || "",
    payload.cto_url || "",
    payload.layout_of_plant_url || "",
    payload.layout_of_storage_area_url || "",
    payload.list_of_hazardous_chemical_handled_url || "",
    payload.list_of_solvents_handled_url || "",
    payload.project_sheet_url || "",
    payload.accidents_reported_past_year || "",
    payload.hazop_report_existing || "",
    payload.existing_fire_fighting_system_details || "",
    payload.safety_audit_report_url || "",
    payload.list_of_ppes_used || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ03",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ03",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ03Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ03(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.type_of_project || "").trim())
    missing.push("Type of Project");
  if (!String(payload.type_of_industry || "").trim())
    missing.push("Type of Industry");
  if (!String(payload.total_land_area_m2 || "").trim())
    missing.push("Total land Area (m²)");
  if (!String(payload.green_belt_area_m2 || "").trim())
    missing.push("Green Belt Area (m²)");
  if (!String(payload.existing_storage_area_m2 || "").trim())
    missing.push("Existing Storage Area (m²)");
  if (!String(payload.proposed_storage_area_m2 || "").trim())
    missing.push("Proposed Storage Area (m²)");

  [
    ["pfr_or_eia_report_url", "PFR Report/EIA report"],
    ["kml_file_url", "KML file"],
    [
      "msds_safety_datasheet_url",
      "MSDS/safety datasheet of Hazardous chemical",
    ],
    ["applicable_tor_details_url", "Applicable TOR Details"],
    ["manufacturing_process_details_url", "Mnaufacturing/Process details"],
    ["process_flow_charts_pid_url", "Process Flow charts/ P&IDs"],
    ["layout_of_plant_url", "Layout of the Plant"],
    [
      "list_of_hazardous_chemical_handled_url",
      "List of Hazardous Chemical handled",
    ],
    ["list_of_solvents_handled_url", "List of Solvents handled"],
    ["project_sheet_url", "Project Sheet"],
  ].forEach(function ([key, label]) {
    if (!String(payload[key] || "").trim()) missing.push(label);
  });

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ04(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ04(payload);

  const sheet = db.getSheetByName("FQ04");
  if (!sheet) throw new Error("Missing sheet: FQ04");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.type_of_project || "",
    payload.type_of_industry || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.total_land_area_m2 || "",
    payload.green_belt_area_m2 || "",
    payload.existing_storage_area_m2 || "",
    payload.proposed_storage_area_m2 || "",
    payload.manpower_details || "",
    payload.pfr_or_eia_report_url || "",
    payload.kml_file_url || "",
    payload.msds_safety_datasheet_url || "",
    payload.applicable_tor_details_url || "",
    payload.manufacturing_process_details_url || "",
    payload.process_flow_charts_pid_url || "",
    payload.layout_of_plant_url || "",
    payload.layout_of_storage_area_url || "",
    payload.list_of_hazardous_chemical_handled || "",
    payload.list_of_solvents_handled || "",
    payload.project_sheet_url || "",
    payload.existing_hazop_report || "",
    payload.existing_qra_report || "",
    payload.existing_fire_fighting_system_details || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ04",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ04",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ04Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ04(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.company_name || "").trim()) missing.push("Company Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.type_of_project || "").trim())
    missing.push("Type of Project");
  if (!String(payload.type_of_industry || "").trim())
    missing.push("Type of Industry");
  if (!String(payload.total_land_area_m2 || "").trim())
    missing.push("Total Land Area");
  if (!String(payload.green_belt_area_m2 || "").trim())
    missing.push("Green Belt Area");
  if (!String(payload.existing_storage_area_m2 || "").trim())
    missing.push("Existing Storage Area");
  if (!String(payload.proposed_storage_area_m2 || "").trim())
    missing.push("Proposed Storage Area");

  [
    ["pfr_or_eia_report_url", "PFR Report/EIA report"],
    ["kml_file_url", "KML file"],
    [
      "msds_safety_datasheet_url",
      "MSDS/safety datasheet of Hazardous chemical",
    ],
    ["applicable_tor_details_url", "Applicable TOR Details"],
    ["manufacturing_process_details_url", "Mnaufacturing/Process details"],
    ["process_flow_charts_pid_url", "Process Flow charts/ P&IDs"],
    ["layout_of_plant_url", "Layout of the Plant"],
    [
      "list_of_hazardous_chemical_handled",
      "List of Hazardous Chemical handled",
    ],
    ["list_of_solvents_handled", "List of Solvents handled"],
    ["project_sheet_url", "Link to Project Sheet"],
  ].forEach(function ([key, label]) {
    if (!String(payload[key] || "").trim()) missing.push(label);
  });

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ06(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ06(payload);

  const sheet = db.getSheetByName("FQ06");
  if (!sheet) throw new Error("Missing sheet: FQ06");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.kml_link || "",
    payload.topo_map_link || "",
    payload.other_maps_link || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ06",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ06",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ06Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ06(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.kml_link || "").trim()) missing.push("Link to KML");
  if (!String(payload.topo_map_link || "").trim())
    missing.push("Link to Topo Map");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ07(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ07(payload);

  const mainSheet = db.getSheetByName("FQ07_main");
  const archSheet = db.getSheetByName("FQ07_archaeological_details");

  if (!mainSheet) throw new Error("Missing sheet: FQ07_main");
  if (!archSheet) throw new Error("Missing sheet: FQ07_archaeological_details");

  mainSheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.type_of_project || "",
    payload.physical_features || "",
    payload.core_zone_type || "",
    payload.buffer_zone_type || "",
    payload.project_area || "",
    payload.build_up_area || "",
    payload.mine_area || "",
    payload.dump_area || "",
    payload.plantation_area || "",
    payload.road_area || "",
    payload.open_area || "",
    payload.other_details || "",
    payload.environmentally_sensitive_area || "",
    payload.core_zone_distance || "",
    payload.buffer_zone_distance || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.fae_report_link || "",
    payload.remarks || "",
  ]);

  (payload.archaeological_details || []).forEach(function (row, index) {
    archSheet.appendRow([
      submissionId,
      index + 1,
      row.name || "",
      row.distance_from_project_site || "",
    ]);
  });

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ07",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ07",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ07Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ07(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.type_of_project || "").trim())
    missing.push("Type of Project");
  if (!String(payload.fae_report_link || "").trim())
    missing.push("FAE report link");

  if (
    payload.archaeological_details &&
    Array.isArray(payload.archaeological_details)
  ) {
    payload.archaeological_details.forEach(function (row, index) {
      const hasAny =
        String(row.name || "").trim() ||
        String(row.distance_from_project_site || "").trim();
      if (hasAny) {
        if (!String(row.name || "").trim())
          missing.push(
            `Archeological or important buildings - Name (row ${index + 1})`,
          );
        if (!String(row.distance_from_project_site || "").trim())
          missing.push(
            `Archeological or important buildings - Distance from project site (row ${index + 1})`,
          );
      }
    });
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ08(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ08(payload);

  const sheet = db.getSheetByName("FQ08");
  if (!sheet) throw new Error("Missing sheet: FQ08");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.type_of_project || "",
    payload.tor_letter_link || "",
    payload.kml_kmz_link || "",
    payload.topo_map_link || "",
    payload.chapter_2_link || "",
    payload.industries_in_study_area || "",
    payload.primary_se_data || "",
    payload.other_info || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId,
    formCode: "FQ08",
    pcode: payload.pcode,
    createdBy: payload.requestor_email,
    now,
    payload,
  });

  appendAuditLog(db, {
    submissionId,
    formCode: "FQ08",
    createdBy: payload.requestor_email,
    now,
    payload,
  });

  sendFQ08Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ08(payload) {
  const missing = [];

  if (!payload.requestor_email) missing.push("Official Email ID");
  if (!payload.team_name) missing.push("Team Name");
  if (!payload.project_name) missing.push("Project Name");
  if (!payload.pcode) missing.push("PCODE");
  if (!payload.type_of_project) missing.push("Type of Project");
  if (!payload.tor_letter_link) missing.push("TOR Letter");
  if (!payload.kml_kmz_link) missing.push("KML/KMZ");
  if (!payload.topo_map_link) missing.push("Topographical Map");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ09(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ09(payload);

  const sheet = db.getSheetByName("FQ09");
  if (!sheet) throw new Error("Missing sheet: FQ09");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.basic_requirements || "",
    payload.layout_upload_link || "",
    payload.coordinates_upload_link || "",
    payload.kml_upload_link || "",
    payload.topo_map_and_sensitivity_required || "",
    payload.other_maps_required || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ09",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ09",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ09Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ09(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.company_name || "").trim()) missing.push("Company Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.sector || "").trim()) missing.push("Sector");
  if (!String(payload.eac_name || "").trim()) missing.push("EAC Name");
  if (!String(payload.layout_upload_link || "").trim())
    missing.push("Layout Upload");
  if (!String(payload.coordinates_upload_link || "").trim())
    missing.push("Coordinates Upload");
  if (!String(payload.kml_upload_link || "").trim()) missing.push("KML Upload");
  if (!String(payload.topo_map_and_sensitivity_required || "").trim())
    missing.push("Topo Map and Sensitivity");

  if (
    String(payload.topo_map_and_sensitivity_required || "")
      .toLowerCase()
      .includes("other maps") &&
    !String(payload.other_maps_required || "").trim()
  ) {
    missing.push("other maps required");
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ10(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ10(payload);

  const sheet = db.getSheetByName("FQ10");
  if (!sheet) throw new Error("Missing sheet: FQ10");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.type_of_work || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.basic_requirements || "",
    payload.layout_upload_link || "",
    payload.coordinates_upload_link || "",
    payload.kml_upload_link || "",
    payload.lu_map_required || "",
    payload.other_maps_required || "",
    payload.sampling_maps_required || "",
    payload.idw_maps_required || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ10",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ10",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ10Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ10(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.company_name || "").trim()) missing.push("Company Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.sector || "").trim()) missing.push("Sector");
  if (!String(payload.eac_name || "").trim()) missing.push("EAC Name");
  if (!String(payload.type_of_work || "").trim()) missing.push("Type of Work");
  if (!String(payload.layout_upload_link || "").trim())
    missing.push("Layout Upload");
  if (!String(payload.coordinates_upload_link || "").trim())
    missing.push("Coordinates Upload");
  if (!String(payload.kml_upload_link || "").trim()) missing.push("KML Upload");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ11(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ11(payload);

  const sheet = db.getSheetByName("FQ11");
  if (!sheet) throw new Error("Missing sheet: FQ11");

  sheet.appendRow([
    submissionId,
    now,
    payload.date || "",
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.address_line1 || "",
    payload.address_line2 || "",
    payload.city || "",
    payload.state || "",
    payload.postal_code || "",
    payload.country || "",
    payload.road_network_residential_localities || "",
    payload.road_width_m || "",
    payload.road_lane || "",
    payload.type_of_road || "",
    payload.road_linkage_from || "",
    payload.road_linkage_to || "",
    payload.parking_requirement || "",
    payload.parking_provision_at_site || "",
    payload.traffic_circulation_plan || "",
    payload.details_of_entry_exit_gates || "",
    payload.parking_photos_url || "",
    payload.traffic_volume_survey_of_roads || "",
    payload.incremental_traffic_from_project_site || "",
    payload.kml_file_url || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ11",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ11",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ11Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ11(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.sector || "").trim()) missing.push("Sector");
  if (!String(payload.eac_name || "").trim()) missing.push("EAC Name");
  if (!String(payload.kml_file_url || "").trim())
    missing.push("KML file of Project");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ13(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ13(payload);

  const sheet = db.getSheetByName("FQ13");
  if (!sheet) throw new Error("Missing sheet: FQ13");

  sheet.appendRow([
    submissionId,
    now,
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.pcode || "",
    payload.project_name || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.additional_report_type || "",
    payload.expected_target_date || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "FQ13",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "FQ13",
    createdBy: payload.requestor_email || "",
    now: now,
    payload: payload,
  });

  sendFQ13Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ13(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.company_name || "").trim()) missing.push("Company Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.sector || "").trim()) missing.push("Sector");
  if (!String(payload.eac_name || "").trim()) missing.push("EAC Name");
  if (!String(payload.additional_report_type || "").trim())
    missing.push("Additional Report Type");
  if (!String(payload.expected_target_date || "").trim())
    missing.push("Expected Target Date");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitFQ15(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateFQ15(payload);

  const sheet = db.getSheetByName("FQ15");
  if (!sheet) throw new Error("Missing sheet: FQ15");

  sheet.appendRow([
    submissionId,
    now,
    payload.requestor_first_name || "",
    payload.requestor_last_name || "",
    payload.requestor_email || "",
    payload.team_name || "",
    payload.company_name || "",
    payload.pcode || "",
    payload.project_name || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.cba_sheet_link || "",
    payload.expected_target_date || "",
    payload.remarks || "",
  ]);

  appendSubmissionLedger(db, {
    submissionId,
    formCode: "FQ15",
    pcode: payload.pcode || "",
    createdBy: payload.requestor_email || "",
    now,
    payload,
  });

  appendAuditLog(db, {
    submissionId,
    formCode: "FQ15",
    createdBy: payload.requestor_email || "",
    now,
    payload,
  });

  sendFQ15Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateFQ15(payload) {
  const missing = [];

  if (!String(payload.requestor_email || "").trim())
    missing.push("Official Email ID of Requestor");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.company_name || "").trim()) missing.push("Company Name");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.eac_name || "").trim()) missing.push("EAC Name");
  if (!String(payload.cba_sheet_link || "").trim())
    missing.push("CBA sheet link");
  if (!String(payload.expected_target_date || "").trim())
    missing.push("Expected Target Date");

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF12(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF12(payload);

  const mainSheet = db.getSheetByName("TF12_main");
  const reviewSheet = db.getSheetByName("TF12_files_to_review");

  if (!mainSheet) throw new Error("Missing sheet: TF12_main");
  if (!reviewSheet) throw new Error("Missing sheet: TF12_files_to_review");

  mainSheet.appendRow([
    submissionId,
    now,
    payload.team_name || "",
    payload.eia_coordinator || "",
    payload.csuite_officer || "",
    payload.company_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.location_of_project || "",
    payload.category || "",
    payload.sector || "",
    payload.eac_name || "",
    payload.stage_of_case || "",
    payload.project_sheet_link || "",
    payload.kml_link || "",
    payload.annexure_folder_link || "",
    payload.initial_pages_link || "",
    payload.target_date_for_review || "",
    payload.remarks || "",
  ]);

  (payload.files_to_be_reviewed || []).forEach(function (row, index) {
    reviewSheet.appendRow([
      submissionId,
      index + 1,
      row.type_of_document || "",
      row.document_link || "",
    ]);
  });

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF12",
    pcode: payload.pcode || "",
    createdBy: payload.eia_coordinator || payload.team_name || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF12",
    createdBy: payload.eia_coordinator || payload.team_name || "",
    now: now,
    payload: payload,
  });

  sendTF12Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF12(payload) {
  const missing = [];

  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.eia_coordinator || "").trim())
    missing.push("EIA Coordinator");
  if (!String(payload.csuite_officer || "").trim())
    missing.push("C-Suite Officer involved");
  if (!String(payload.project_name || "").trim())
    missing.push("Name of the project");
  if (!String(payload.pcode || "").trim()) missing.push("PCODE");
  if (!String(payload.location_of_project || "").trim())
    missing.push("Location of the project");
  if (!String(payload.category || "").trim()) missing.push("Category");
  if (!String(payload.sector || "").trim()) missing.push("Sector");
  if (!String(payload.eac_name || "").trim()) missing.push("EAC Name");
  if (!String(payload.stage_of_case || "").trim())
    missing.push("Status/ Stage of the Case");
  if (!String(payload.project_sheet_link || "").trim())
    missing.push("Link to Project Sheet");
  if (!String(payload.kml_link || "").trim()) missing.push("Link to KML");
  if (!String(payload.target_date_for_review || "").trim())
    missing.push("Target Date for review");

  const files = Array.isArray(payload.files_to_be_reviewed)
    ? payload.files_to_be_reviewed
    : [];
  const usableRows = files.filter(function (r) {
    return (
      String(r.type_of_document || "").trim() ||
      String(r.document_link || "").trim()
    );
  });

  if (!usableRows.length) {
    missing.push("Files to be reviewed");
  } else {
    usableRows.forEach(function (row, index) {
      if (!String(row.type_of_document || "").trim()) {
        missing.push(
          `Files to be reviewed - Type of document (row ${index + 1})`,
        );
      }
      if (!String(row.document_link || "").trim()) {
        missing.push(`Files to be reviewed - Link (row ${index + 1})`);
      }
    });
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}

function submitTF17(payload) {
  const db = getDB();
  const now = new Date();
  const submissionId = Utilities.getUuid();

  payload = payload || {};
  payload.submission_id = submissionId;

  validateTF17(payload);

  const mainSheet = db.getSheetByName("TF17_main");
  const inviteeSheet = db.getSheetByName("TF17_person_expert_invited");
  const actionSheet = db.getSheetByName("TF17_action_points");

  if (!mainSheet) throw new Error("Missing sheet: TF17_main");
  if (!inviteeSheet)
    throw new Error("Missing sheet: TF17_person_expert_invited");
  if (!actionSheet) throw new Error("Missing sheet: TF17_action_points");

  mainSheet.appendRow([
    submissionId,
    now,
    payload.employee_first_name || "",
    payload.employee_last_name || "",
    payload.employee_email || "",
    payload.team_name || "",
    payload.project_name || "",
    payload.pcode || "",
    payload.category || "",
    payload.eac_seac || "",
    payload.agenda_number || "",
    payload.mom_publish_date || "",
    payload.mom_link || "",
    payload.remarks || "",
  ]);

  (payload.person_expert_invited || []).forEach(function (row, index) {
    inviteeSheet.appendRow([
      submissionId,
      index + 1,
      row.name_of_invitee || "",
      row.email_id_of_invitee || "",
    ]);
  });

  (payload.action_points || []).forEach(function (row, index) {
    actionSheet.appendRow([
      submissionId,
      index + 1,
      row.actionable_point || "",
      row.responsible_person_name || "",
    ]);
  });

  appendSubmissionLedger(db, {
    submissionId: submissionId,
    formCode: "TF17",
    pcode: payload.pcode || "",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  appendAuditLog(db, {
    submissionId: submissionId,
    formCode: "TF17",
    createdBy: payload.employee_email || "",
    now: now,
    payload: payload,
  });

  sendTF17Email(payload, submissionId);

  return {
    ok: true,
    submission_id: submissionId,
    thankYouHtml: HtmlService.createTemplateFromFile("thankyou")
      .evaluate()
      .getContent(),
  };
}

function validateTF17(payload) {
  const missing = [];

  if (!String(payload.employee_email || "").trim())
    missing.push("Employee Email ID");
  if (!String(payload.team_name || "").trim()) missing.push("Team Name");
  if (!String(payload.project_name || "").trim()) missing.push("Project Name");
  if (!String(payload.pcode || "").trim()) missing.push("Project Code");
  if (!String(payload.agenda_number || "").trim())
    missing.push("Agenda Number");
  if (!String(payload.mom_publish_date || "").trim())
    missing.push("MoM publish date");
  if (!String(payload.mom_link || "").trim()) missing.push("MoM link");

  const invitees = Array.isArray(payload.person_expert_invited)
    ? payload.person_expert_invited
    : [];
  const usedInvitees = invitees.filter(function (r) {
    return (
      String(r.name_of_invitee || "").trim() ||
      String(r.email_id_of_invitee || "").trim()
    );
  });

  if (!usedInvitees.length) {
    missing.push("Person/Expert Invited");
  } else {
    usedInvitees.forEach(function (row, index) {
      if (!String(row.name_of_invitee || "").trim())
        missing.push(
          `Person/Expert Invited - Name of Invitee (row ${index + 1})`,
        );
      if (!String(row.email_id_of_invitee || "").trim())
        missing.push(
          `Person/Expert Invited - Email ID of Invitee (row ${index + 1})`,
        );
    });
  }

  const actions = Array.isArray(payload.action_points)
    ? payload.action_points
    : [];
  const usedActions = actions.filter(function (r) {
    return (
      String(r.actionable_point || "").trim() ||
      String(r.responsible_person_name || "").trim()
    );
  });

  if (!usedActions.length) {
    missing.push("Action Points and responsibility");
  } else {
    usedActions.forEach(function (row, index) {
      if (!String(row.actionable_point || "").trim())
        missing.push(
          `Action Points and responsibility - actionable point (row ${index + 1})`,
        );
      if (!String(row.responsible_person_name || "").trim())
        missing.push(
          `Action Points and responsibility - responsible person name (row ${index + 1})`,
        );
    });
  }

  if (missing.length) {
    throw new Error("Please fill:\n\n" + missing.join("\n"));
  }
}
