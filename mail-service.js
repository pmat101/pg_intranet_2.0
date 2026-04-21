function sendFormEmail(formCode, payload, submissionId) {
  const recipients = "pranav.mathur@perfactgroup.in";
  const subject = formCode + " submitted - " + submissionId;
  const body = buildEmailBody(formCode, payload, submissionId);

  GmailApp.sendEmail(recipients, subject, body);
}

function buildEmailBody(formCode, payload, submissionId) {
  const nl = "\n";

  let body = "";
  body += "Dear Team," + nl + nl;
  body += "WPF01 has been submitted." + nl + nl;

  body += "Submission ID: " + submissionId + nl;
  body += "Team: " + payload.team_name + nl;
  body += "Week: " + payload.week_start + " to " + payload.week_end + nl;
  body += "TF Filled: " + payload.tf_filled + nl;
  body += "Milestone Achieved: " + payload.milestone_achieved + nl;
  body += "Total Working Hours: " + payload.total_working_hours + nl;

  body += nl + "---------------- TF DETAILS ----------------" + nl;

  payload.tf_details.forEach((r, i) => {
    body +=
      `${i + 1}. ${r.tf_name} | Planned: ${r.planned_last_week} | Achieved: ${r.achieving_this_week} | Next: ${r.plan_for_next_week}` +
      nl;
  });

  body += nl + "---------------- TEAM WORK ----------------" + nl;

  payload.weekly_team_details.forEach((r, i) => {
    body +=
      `${i + 1}. ${r.name} | ${r.project_name} | ${r.pcode} | ${r.time_spent} hrs | ${r.status}` +
      nl;
  });

  body += nl + "Targets Planned:" + nl + payload.targets_planned_this_week + nl;
  body +=
    nl + "Targets Achieved:" + nl + payload.targets_achieved_this_week + nl;
  body += nl + "Highlights:" + nl + payload.highlights + nl;

  return body;
}

function sendWPF01Email(payload, submissionId) {
  const to = "priority.wg@perfactgroup.in, gov.council@perfactgroup.in";
  const cc = buildTeamCc(payload.team_name) + ", pranav.mathur@perfactgroup.in";
  const subject =
    "Team Performance of " +
    (payload.team_name || "") +
    " for the week (" +
    (payload.week_start || "") +
    " to " +
    (payload.week_end || "") +
    ")";

  const htmlBody = buildWPF01EmailHtml(payload, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "WPF01",
    cc: cc,
  });
}

function buildTeamCc(teamName) {
  const safe = String(teamName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return safe ? safe + "@perfactgroup.in" : "";
}

function buildWPF01EmailHtml(payload, submissionId) {
  const esc = escapeHtml;

  function row(cells) {
    return `
      <tr>
        ${cells
          .map(
            (c) =>
              `<td style="border:1px solid #ccc;padding:6px;vertical-align:top;">${esc(
                String(c ?? ""),
              )}</td>`,
          )
          .join("")}
      </tr>
    `;
  }

  function table(title, headers, rowsHtml) {
    return `
      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">${esc(title)}</div>
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead>
            <tr>
              ${headers
                .map(
                  (h) =>
                    `<th style="border:1px solid #ccc;padding:6px;text-align:left;background:#f5f5f5;">${esc(
                      h,
                    )}</th>`,
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || ""}
          </tbody>
        </table>
      </div>
    `;
  }

  const summaryRows = [
    // row(["Submission ID", submissionId]),
    row(["Week Start Date", payload.week_start || ""]),
    row(["Week End Date", payload.week_end || ""]),
    row(["Team Name", payload.team_name || ""]),
    row(["TFs filled this week", payload.tf_filled || ""]),
    row(["Milestone achieved this week", payload.milestone_achieved || ""]),
    row(["Number of Active Projects", payload.number_of_active_projects || ""]),
    row(["Total Working Hours", payload.total_working_hours || ""]),
    row(["Internal Bottlenecks", payload.internal_bottlenecks || ""]),
    row(["External Bottlenecks", payload.external_bottlenecks || ""]),
  ].join("");

  const tfRows = (payload.tf_details || [])
    .map((r, i) =>
      row([
        i + 1,
        r.tf_name || "",
        r.planned_last_week || "",
        r.achieving_this_week || "",
        r.plan_for_next_week || "",
      ]),
    )
    .join("");

  const milestoneRows = (payload.milestone_details || [])
    .map((r, i) =>
      row([
        i + 1,
        r.milestone_achieved || "",
        r.pcode || "",
        r.project_name || "",
        r.special_notes || "",
      ]),
    )
    .join("");

  const teamInfoRows = (payload.weekly_team_info || [])
    .map((r, i) =>
      row([
        i + 1,
        r.name || "",
        r.designation || "",
        r.working_days || "",
        r.site_visit_days || "",
      ]),
    )
    .join("");

  const workRows = (payload.weekly_team_details || [])
    .map((r, i) =>
      row([
        i + 1,
        r.name || "",
        r.project_name || "",
        r.pcode || "",
        r.task_description || "",
        r.time_spent || "",
      ]),
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear Work Priority WG members,</p>
      <p>
        Team Performance of <b>${esc(payload.team_name || "")}</b> for the week
        (${esc(payload.week_start || "")} - ${esc(payload.week_end || "")})
        has been submitted successfully for your review.
      </p>

      ${table("Submission Summary", ["Field", "Value"], summaryRows)}
      ${table("Number of TFs Filled", ["#", "TF Name", "Planned Last Week", "Achieving This Week", "Plan for Next Week"], tfRows)}
      ${table("Details of Milestone Achieved", ["#", "Milestone Achieved", "PCODE", "Project Name", "Please Specify"], milestoneRows)}
      ${table("Weekly Team Work Info", ["#", "Name", "Designation", "Working Days", "Site Visit Days"], teamInfoRows)}
      ${table("Weekly Team Work Details", ["#", "Name", "Project Name", "PCODE", "Task Description", "Time Spent"], workRows)}

      <p style="margin-top:18px;">Regards,<br/>WPF01</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendBD01AEmail(payload, submissionId, proposalID, pcode) {
  const to = `glacier@perfactgroup.in, ${payload.officialEmail}`;
  const ccList = "info@perfactgroup.in";

  const subject = `New Proposal lead for ${payload.customerCompany} having ID ${proposalID} has been created successfully`;
  const htmlBody = buildBD01AEmailHtml(
    payload,
    submissionId,
    proposalID,
    pcode,
  );

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "BD-01(A)",
    cc: ccList,
  });
}

function buildBD01AEmailHtml(payload, submissionId, proposalID, pcode) {
  const esc = escapeHtml;

  function row(label, value) {
    return `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;background:#f5f5f5;font-weight:600;">${esc(label)}</td>
        <td style="border:1px solid #ccc;padding:6px;">${esc(String(value || ""))}</td>
      </tr>
    `;
  }

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear ${payload.formFillerFirstName} ${payload.formFillerLastName},</p>
      <p>Your Proposal ID ${proposalID} dated ${payload.leadDate} has been generated successfully</p>  

      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <tbody>
          ${row("Submission ID", submissionId)}
          ${row("Proposal ID", proposalID)}
          ${row("PCODE", pcode)}
          ${row("Lead Date", payload.leadDate)}
          ${row("Form Filler", `${payload.formFillerFirstName || ""} ${payload.formFillerLastName || ""}`.trim())}
          ${row("Official Email", payload.officialEmail)}
          ${row("Customer Company", payload.customerCompany)}
          ${row("Customer Name", `${payload.customerFirstName || ""} ${payload.customerLastName || ""}`.trim())}
          ${row("Customer Contact", payload.customerContact)}
          ${row("Customer Email", payload.customerEmail)}
          ${row("Repeat Customer", payload.isRepeatCustomer)}
          ${row("Activity Proposed", payload.activityProposed)}
          ${row("Location", [payload.village, payload.taluka, payload.district, payload.state, payload.postalCode, payload.country].filter(Boolean).join(", "))}
          ${row("ST/UT", payload.stUt)}
          ${row("Work Type", payload.workType)}
          ${row("Sector", payload.sector)}
          ${row("Specifications", payload.specs)}
          ${row("Financial Year", payload.finYear)}
          ${row("PG Company", payload.pgCompany)}
          ${row("Customer Classification", payload.customerClass)}
          ${row("Lead Source", payload.leadSource)}
          ${row("RFQ / Scope URL", payload.rfqUrl)}
          ${row("Remarks", payload.remarks)}
        </tbody>
      </table>

      <p style="margin-top:18px;">Regards,<br/>BD-01(A)</p>
    </div>
  `;
}

function sendBD02Email(payload, submissionId) {
  const to = `glacier@perfactgroup.in, ${payload.officialEmail}`;
  const cc = "arctic@perfactgroup.in, info@perfactgroup.in";

  const subject = `New Proposal ID ${payload.proposalId} of ${payload.customerCompany} has been won with Project code ${payload.pcode}`;
  const htmlBody = buildBD02EmailHtml(payload, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "BD02",
    cc: cc,
  });
}

function buildBD02EmailHtml(payload, submissionId) {
  const esc = escapeHtml;

  function row(label, value) {
    return `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;background:#f5f5f5;font-weight:600;">${esc(label)}</td>
        <td style="border:1px solid #ccc;padding:6px;">${esc(String(value || ""))}</td>
      </tr>
    `;
  }

  function section(title, rowsHtml) {
    return `
      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">${esc(title)}</div>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  const customerRows = [
    row("Lead Date", payload.leadDate || ""),
    row("Official Email", payload.officialEmail || ""),
    row(
      "Form Filler",
      `${payload.formFillerFirstName || ""} ${payload.formFillerLastName || ""}`.trim(),
    ),
    row("Customer Company", payload.customerCompany || ""),
    row(
      "Customer Name",
      `${payload.customerFirstName || ""} ${payload.customerLastName || ""}`.trim(),
    ),
    row(
      "Customer Contact",
      `${payload.customerContactCode || ""} ${payload.customerContactNumber || ""}`.trim(),
    ),
    row("Customer Email", payload.customerEmail || ""),
  ].join("");

  const complianceRows = [
    row("GST Available", payload.gstAvailable || ""),
    row("GST Number", payload.gstNumber || ""),
    row("PAN Available", payload.panAvailable || ""),
    row("PAN Number", payload.panNumber || ""),
    row("TAN Available", payload.tanAvailable || ""),
    row("TAN Number", payload.tanNumber || ""),
    row("GST Treatment", payload.gstTreatment || ""),
  ].join("");

  const projectRows = [
    row("Submission ID", submissionId),
    row("Project Name", payload.projectName || ""),
    row("Project Location", payload.projectLocation || ""),
    row("Proposal ID", payload.proposalId || ""),
    row("P CODE", payload.pcode || ""),
    row("Date of Proposal Sent", payload.dateProposalSent || ""),
    row("Date of Proposal Won", payload.dateProposalWon || ""),
    row(
      "Link of Proposal Trends/Summary",
      payload.proposalTrendsSummaryLink || "",
    ),
    row("Link to Work Order", payload.workOrderLink || ""),
    row("Link to sales order", payload.salesOrderLink || ""),
    row("Link to Cost Computer", payload.costComputerLink || ""),
    row("Link to final proposal", payload.finalProposalLink || ""),
    row("PR.R", payload.prR || ""),
    row("PR.B", payload.prB || ""),
    row(
      "Travelling Expenses in Perfact Group's scope",
      payload.travellingExpensesInScope || "",
    ),
    row("PR Mode", payload.prMode || ""),
  ].join("");

  const costRows = [
    row("Overhead Costs", payload.overheadCosts || ""),
    row("Testing charges", payload.testingCharges || ""),
    row("Admin Expenses", payload.adminExpenses || ""),
    row("Manpower costs", payload.manpowerCosts || ""),
    row("Outsourcing costs", payload.outsourcingCosts || ""),
    row("Comissions", payload.commissions || ""),
    row("Outsourced Manpower", payload.outsourcedManpower || ""),
    row("Secondary data costs", payload.secondaryDataCosts || ""),
    row("Contingency costs", payload.contingencyCosts || ""),
    row("Site visit costs", payload.siteVisitCosts || ""),
    row(
      "Project Base Level cost (PBL) - in Lacs",
      payload.projectBaseLevelCost || "",
    ),
    row("Final quote value (PBL10) - in Lacs", payload.finalQuoteValue || ""),
    row("Percentage Margin", payload.percentageMargin || ""),
  ].join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear Team,</p>
      <p>BD-02 has been submitted successfully.</p>

      ${section("Customer Details", customerRows)}
      ${section("GST / PAN / TAN", complianceRows)}
      ${section("Project Details", projectRows)}
      ${section("Costing", costRows)}

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Remarks</div>
        <div style="border:1px solid #ccc;padding:8px;">${esc(payload.remarks || "")}</div>
      </div>

      <p style="margin-top:18px;">Regards,<br/>BD02</p>
    </div>
  `;
}

function sendBD03Email(payload, submissionId) {
  const toList = `glacier@perfactgroup.in, ${payload.official_email}`;

  const ccList = `${payload.csuite_officer_email}, ${payload.eia_coordinator_email}, ${payload.team_name}@perfactgroup.in, accounts@perfactgroup.in`;

  const subject = `New Project with PCode ${payload.pcode} of ${payload.project_name} has been won and assigned to ${payload.team_name}`;

  const htmlBody = buildBD03EmailHtml(payload, submissionId);

  GmailApp.sendEmail(toList, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "BD03",
    cc: ccList,
  });
}

function buildBD03EmailHtml(payload, submissionId) {
  const esc = escapeHtml;

  function row(label, value) {
    return `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;background:#f5f5f5;font-weight:600;">${esc(label)}</td>
        <td style="border:1px solid #ccc;padding:6px;">${esc(String(value || ""))}</td>
      </tr>
    `;
  }

  function section(title, rowsHtml) {
    return `
      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">${esc(title)}</div>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  const mainRows = [
    row("Submission ID", submissionId),
    row("Lead Date", payload.lead_date || ""),
    row(
      "Form Filler",
      `${payload.form_filler_first_name || ""} ${payload.form_filler_last_name || ""}`.trim(),
    ),
    row("Official Email", payload.official_email || ""),
    row("Team Name", payload.team_name || ""),
    row(
      "Team Head",
      `${payload.team_head_first_name || ""} ${payload.team_head_last_name || ""}`.trim(),
    ),
    row("Team Head Email", payload.team_head_email || ""),
    row("C-Suite Officer", payload.csuite_officer_name || ""),
    row("C-Suite Officer Email", payload.csuite_officer_email || ""),
    row("EIA Coordinator", payload.eia_coordinator_name || ""),
    row("EIA Coordinator Email", payload.eia_coordinator_email || ""),
    row("Customer Company", payload.customer_company || ""),
    row(
      "Client Name",
      `${payload.client_first_name || ""} ${payload.client_last_name || ""}`.trim(),
    ),
    row(
      "Client Contact",
      `${payload.client_contact_code || ""} ${payload.client_contact_number || ""}`.trim(),
    ),
    row("Client Email", payload.client_email || ""),
    row("Project Name", payload.project_name || ""),
    row(
      "Project Location",
      [
        payload.project_location_address_line1,
        payload.project_location_village,
        payload.project_location_taluka,
        payload.project_location_district,
        payload.project_location_state,
        payload.project_location_postal_code,
        payload.project_location_country,
      ]
        .filter(Boolean)
        .join(", "),
    ),
    row("Type of Work", payload.type_of_work || ""),
    row("PCode", payload.pcode || ""),
    row("Current Status", payload.current_status || ""),
    row("Gantt Chart Link", payload.gantt_chart_link || ""),
    row("Date of Updating", payload.date_of_updating || ""),
    row("Project Start Date", payload.project_start_date || ""),
    row(
      "General Conditions Applicability",
      payload.general_conditions_applicability || "",
    ),
    row("Overhead Expenses borne by", payload.overhead_expenses_borne_by || ""),
    row("Travelling borne by", payload.travelling_borne_by || ""),
    row("Category", payload.category || ""),
    row(
      "Service Type/ Code/ NABET Sector",
      payload.service_type_code_nabet_sector || "",
    ),
    row("Baseline Season", payload.baseline_season || ""),
    row("EAC Name", payload.eac_name || ""),
    row("Perfact Group company name", payload.pg_company || ""),
    row("Relevant documents URL", payload.relevant_documents_url || ""),
  ].join("");

  const otherPersonsRows = (payload.other_persons || [])
    .map((r, i) =>
      row(i + 1, `${r.name || ""} | ${r.email || ""} | ${r.purpose || ""}`),
    )
    .join("");

  const milestoneRows = (payload.milestones || [])
    .map((r, i) =>
      row(
        i + 1,
        `${r.milestone_no || ""} | ${r.milestone_name || ""} | ${r.planned_date || ""} | ${r.billing_percent || ""}`,
      ),
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear Team,</p>
      <p>BD03 has been submitted successfully.</p>

      ${section("Main Details", mainRows)}
      ${section("Any other person whom details to be shared", otherPersonsRows || row("1", "No additional persons added"))}
      ${section("Milestone Achieved Details", milestoneRows || row("1", "No milestones added"))}

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Scope of Work</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(payload.scope_of_work || "")}</div>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Terms and Conditions</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(payload.terms_and_conditions || "")}</div>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Details of previous EC and consents</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(payload.details_of_previous_ec_and_consents || "")}</div>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Remarks</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(payload.remarks || "")}</div>
      </div>

      <p style="margin-top:18px;">Regards,<br/>BD03</p>
    </div>
  `;
}

function sendTF02Email(p, submissionId) {
  const to = `${p.employee_email}`;
  const ccList = `info@perfactgroup.in, teameia@perfactgroup.in, ${p.eia_coordinator_name}@perfactgroup.in, ${p.teamName}@perfactgroup.in`;
  const subject = `Submission on appraisal meeting dated- ${p.meeting_date || ""} completion of Project- ${p.project_name || ""} for ${p.meeting_type || ""} -meeting at Agenda no. ${p.agenda_number || ""} in committee- ${p.committee_name || ""}`;
  const htmlBody = buildTF02EmailHtml(p, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "TF02",
    cc: ccList,
  });
}

function buildTF02EmailHtml(p, submissionId) {
  const esc = escapeHtml;

  function row(label, value) {
    return `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;background:#f5f5f5;font-weight:600;">${esc(label)}</td>
        <td style="border:1px solid #ccc;padding:6px;">${esc(String(value || ""))}</td>
      </tr>
    `;
  }

  function section(title, rowsHtml) {
    return `
      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">${esc(title)}</div>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  const summaryRows = [
    row("Submission ID", submissionId),
    row("Date", p.date || ""),
    row("Employee Email", p.employee_email || ""),
    row("Team Name", p.team_name || ""),
    row("EIA Coordinator", p.eia_coordinator_name || ""),
    row("Committee", p.committee_name || ""),
    row("Agenda Number", p.agenda_number || ""),
    row("Project Name", p.project_name || ""),
    row("PCode", p.pcode || ""),
    row("Date of Meeting", p.meeting_date || ""),
    row("Time of Meeting", p.meeting_time || ""),
    row("Meeting Recording Link", p.meeting_recording_link || ""),
    row("Final Presentation Link", p.final_presentation_link || ""),
  ].join("");

  const otherText = [
    row("Type of Meeting", p.meeting_type || ""),
    row("Type of Meeting - Other", p.meeting_type_other || ""),
    row("Case Recommended", p.case_recommended || ""),
    row("Case Recommended - Other", p.case_recommended_other || ""),
  ].join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear Team,</p>
      <p>TF02 has been submitted successfully.</p>

      ${section("Submission Summary", summaryRows)}
      ${section("Meeting / Recommendation", otherText)}

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">QCC Reviewers</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(p.qcc_reviewers || "")}</div>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Key Points & Queries Raised by EAC</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(p.key_points_queries || "")}</div>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Immediate Actions Required</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(p.immediate_actions || "")}</div>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Warning Signs</div>
        <div style="border:1px solid #ccc;padding:8px;white-space:pre-wrap;">${esc(p.warning_signs || "")}</div>
      </div>

      <p style="margin-top:18px;">Regards,<br/>TF02</p>
    </div>
  `;
}
