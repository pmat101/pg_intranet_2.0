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
    .trim()
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
    // row("Submission ID", submissionId),
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
    // row("Submission ID", submissionId),
    row("Lead Date", payload.lead_date || ""),
    row(
      "Form Filler",
      `${payload.form_filler_first_name || ""} ${payload.form_filler_last_name || ""}`.trim(),
    ),
    row("Official Email", payload.official_email || ""),
    row("Team Name", payload.team || ""),
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
        [
          `Name: ${r.milestone_name || ""}`,
          `Details: ${r.milestone_details || ""}`,
          `Timeline: ${r.timeline || ""}`,
          `% Billing: ${r.billing_percent || ""}`,
        ].join(" | "),
      ),
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear ${payload.form_filler_first_name || ""} ${payload.form_filler_last_name || ""},</p>
      <p>New Project ${payload.project_name || ""} with PCode ${payload.pcode || ""} has been won and assigned to ${payload.team || ""} </p>

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
  const ccList = `info@perfactgroup.in, teameia@perfactgroup.in, ${p.eia_coordinator_email}, ${buildTeamCc(p.team_name)}`;
  const subject = `Submission on appraisal meeting dated- ${p.meeting_date || ""} completion of Project- ${truncate(p.project_name, 42)} for ${p.meeting_type || ""} -meeting at Agenda no. ${p.agenda_number || ""} in committee- ${p.committee_name || ""}`;
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

  const basicRows = [
    row("Date", p.date),
    row("Employee Name", `${p.first_name || ""} ${p.last_name || ""}`),
    row("Employee Email", p.employee_email),
    row("Team", p.team_name),
    row("EIA Coordinator", p.eia_coordinator_name),
    row("QCC Reviewers", p.qcc_reviewers),
  ].join("");

  const projectRows = [
    row("Project Name", p.project_name),
    row("Project Code", p.pcode),
    row("Proposal Number", p.proposal_number),
    row("Committee", p.committee_name),
    row("Agenda Number", p.agenda_number),
    row("Case Type", p.case_type),
  ].join("");

  const meetingRows = [
    row(
      "Meeting Type",
      p.meeting_type === "Others" ? p.meeting_type_other : p.meeting_type,
    ),
    row("Meeting Date", p.meeting_date),
    row("Meeting Time", p.meeting_time),
    row("Perfact Officials", p.perfact_officials),
    row("Project Proponent", p.project_proponent),
    row(
      "Presenter",
      `${p.presenter_first_name || ""} ${p.presenter_last_name || ""}`,
    ),
  ].join("");

  const costRows = [
    row("Proposed Project Cost", p.proposed_project_cost),
    row("Existing Project Cost", p.existing_project_cost),
  ].join("");

  const analysisRows = [
    row("Key Points & Queries", p.key_points_queries),
    row("EAC Future Focus", p.eac_future_focus),
    row("FAE Suggestions", p.fae_suggestions),
    row("PPT Changes", p.ppt_changes),
    row("Immediate Actions", p.immediate_actions),
    row("Post Submittal Points", p.post_submittal_points),
    row("Key Learnings", p.key_learnings),
    row("Struggles & Reason", p.struggles_and_reason),
    row("Future Implications", p.future_implications),
  ].join("");

  const decisionRows = [
    row(
      "Case Recommended",
      p.case_recommended === "Others"
        ? p.case_recommended_other
        : p.case_recommended,
    ),
    row("Warning Signs", p.warning_signs),
    row("Action Points", p.action_points),
  ].join("");

  const linksRows = [
    row("Meeting Recording", p.meeting_recording_link),
    row("Final Presentation", p.final_presentation_link),
  ].join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear all,</p>
      <p>Submission on appraisal meeting dated- ${p.meeting_date || ""} completion of Project- ${p.project_name} for ${p.meeting_type || ""} -meeting at Agenda no. ${p.agenda_number || ""} in committee- ${p.committee_name || ""}</p>

      ${section("Basic Details", basicRows)}
      ${section("Project Details", projectRows)}
      ${section("Meeting Details", meetingRows)}
      ${section("Project Cost", costRows)}
      ${section("Technical Analysis", analysisRows)}
      ${section("Decision & Risk", decisionRows)}
      ${section("Links", linksRows)}

      <div style="margin-top:18px;">
        <div style="font-weight:700;margin-bottom:8px;">Remarks</div>
        <div style="border:1px solid #ccc;padding:8px;">${esc(p.remarks)}</div>
      </div>

      <p style="margin-top:18px;">Regards,<br/>TF02</p>
    </div>
  `;
}

function sendWPF03Email(payload, submissionId) {
  const to = "priority.wg@perfactgroup.in, gov.council@perfactgroup.in";
  const cc =
    "fountain@perfactgroup.in, rachna.dogra@perfactgroup.in, pranav.mathur@perfactgroup.in";

  const subject = `Team Performance of Fountain for the week ${payload.week_start_date || ""} to ${payload.week_end_date || ""}`;
  const htmlBody = buildWPF03EmailHtml(payload, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "WPF03",
    cc: cc,
  });
}

function buildWPF03EmailHtml(payload, submissionId) {
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
    // row("Submission ID", submissionId),
    row("Week Start Date", payload.week_start_date || ""),
    row("Week End Date", payload.week_end_date || ""),
    row("Team Name", payload.team_name || "Fountain"),
    row("Test Reports Issued", payload.test_reports_issued || ""),
    row("Test Reports Planned", payload.test_reports_planned || ""),
    row("Monitorings Completed", payload.monitorings_completed || ""),
    row("Monitorings Planned", payload.monitorings_planned || ""),
    row("Data Review Priority", payload.data_review_priority || ""),
    row("Highlights", payload.highlights || ""),
    row("Low Points", payload.low_points || ""),
    row("Challenges Faced", payload.challenges_faced || ""),
    row(
      "Projected Targets for Next Week",
      payload.projected_targets_next_week || "",
    ),
    row("Weekly PPT Link", payload.weekly_ppt_link || ""),
  ].join("");

  const analysisRows = (payload.analysis_rows || [])
    .map(function (r, i) {
      return row(
        `${i + 1}. ${r.analysis_item || ""}`,
        `Planned: ${r.planned_last_week || ""} | Achieving: ${r.achieving_this_week || ""} | Next: ${r.plan_for_next_week || ""}`,
      );
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear Work Priority WG,</p>
      <p>Team Performance of Fountain for the week ${payload.week_start_date || ""} to ${payload.week_end_date || ""} has been submitted successfully for your review.</p>

      ${section("Submission Summary", summaryRows)}
      ${section("Analysis", analysisRows)}

      <p style="margin-top:18px;">Regards,<br/>WPF03</p>
    </div>
  `;
}

function sendTF01Email(payload, submissionId) {
  const to = payload.employee_email;
  const cc = `logistics.wg@perfactgroup.in, topmanagement@perfactgroup.in, ${buildTeamCc(payload.team_name)}`;
  const subject = `Requisition slip printing`;
  const htmlBody = buildTF01EmailHtml(payload, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "TF01",
    cc: cc,
  });
}

function buildTF01EmailHtml(payload, submissionId) {
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
    row("Date", payload.date || ""),
    row(
      "Employee",
      `${payload.employee_first_name || ""} ${payload.employee_last_name || ""}`.trim(),
    ),
    row("Employee Email", payload.employee_email || ""),
    row("Team Name", payload.team_name || ""),
    row("Remarks", payload.remarks || ""),
  ].join("");

  const projectRows = (payload.project_details || [])
    .map(function (r, i) {
      return row(
        `Project ${i + 1}`,
        [
          `Project: ${r.project_name || ""}`,
          `PCODE: ${r.pcode || ""}`,
          `PP: ${r.pp_name || ""}`,
          `Report: ${r.report_name || ""}`,
          `Purpose: ${r.purpose_of_printing || ""}`,
          `PDF: ${r.pdf_link || ""}`,
          `Pages: ${r.no_of_pages || ""}`,
          `Print: ${r.type_of_print || ""}`,
          `Copies: ${r.no_of_copies || ""}`,
        ].join(" | "),
      );
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear ${payload.employee_first_name || ""} ${payload.employee_last_name || ""},</p>
      <p>Your Requisition Slip For Printing response dated ${payload.date || ""} has been submitted successfully and sent for further processing.</p>

      ${section("Main Details", mainRows)}
      ${section("Project(s) Details", projectRows)}

      <p style="margin-top:18px;">Regards,<br/>TF01</p>
    </div>
  `;
}

function sendBD03Email(payload, submissionId) {
  const recipients = `glacier@perfactgroup.in, ${payload.official_email}, ${buildTeamCc(payload.team)}`;
  const otherEmails = (payload.other_persons || [])
    .map((p) => p.email)
    .filter((e) => e)
    .join(",");
  const ccList = [
    payload.csuite_officer_email,
    payload.eia_coordinator_email,
    "topmanagement@perfactgroup.in",
    "accounts@perfactgroup.in",
    "info@perfactgroup.in",
    payload.team_head_email,
    otherEmails,
  ]
    .filter(Boolean)
    .join(",");
  const subject = `New Project ${truncate(payload.project_name, 84)} with PCode ${payload.pcode || ""} has been won and assigned to ${payload.team || ""}`;
  const htmlBody = buildBD03EmailHtml(payload, submissionId);

  GmailApp.sendEmail(recipients, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "BD03",
    cc: ccList,
  });
}

function truncate(text, maxLength) {
  text = String(text || "");
  return text.length > maxLength
    ? text.substring(0, maxLength).trim() + "..."
    : text;
}

function sendTF22Email(payload, submissionId) {
  const toList = `${payload.employee_email}, ${buildTeamCc(payload.team_name)}`;
  const ccList =
    "info@perfactgroup.in, accounts@perfactgroup.in, glacier@perfactgroup.in";

  const subject = `Accounts info wrt submission/ completion of project for ${payload.type_of_work} of Project- ${truncate(payload.project_name, 42)} with PCode- ${payload.project_code} and Service Type- ${payload.type_of_service}`;
  const htmlBody = buildTF22EmailHtml(payload, submissionId);

  GmailApp.sendEmail(toList, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "TF22",
    cc: ccList,
  });
}

function buildTF22EmailHtml(payload, submissionId) {
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
      <p>Dear ${payload.employee_first_name || ""} ${payload.employee_last_name || ""},</p>
      <p>Account section wrt submission/ completion of project for  ${payload.type_of_work} of Project- ${payload.project_name} with PCode- ${payload.project_code} and Service Type- ${payload.type_of_service} has been submitted and sent for review.</p>

      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <tbody>
          ${row("Date", payload.date || "")}
          ${row("Employee Name", `${payload.employee_first_name || ""} ${payload.employee_last_name || ""}`.trim())}
          ${row("Employee Email", payload.employee_email || "")}
          ${row("Team", payload.team_name || "")}
          ${row("Type of Work", payload.type_of_work || "")}
          ${row("Project Name", payload.project_name || "")}
          ${row("Date of Completion", payload.date_of_completion || "")}
          ${row("Project Code", payload.project_code || "")}
          ${row("Type of Service", payload.type_of_service || "")}
          ${row("Attachments URL", payload.attachments_url || "")}
          ${row("Remarks", payload.remarks || "")}
        </tbody>
      </table>

      <p style="margin-top:18px;">Regards,<br/>TF22</p>
    </div>
  `;
}

function sendTF07Email(payload, submissionId) {
  const to = [payload.employee_email, payload.email_of_person_to_bill]
    .filter(Boolean)
    .join(",");

  const cc = ["info@perfactgroup.in", buildTeamCc(payload.team_name)]
    .filter(Boolean)
    .join(",");

  const subject = `TF07 | ${payload.project_name || ""} | ${payload.project_code || ""}`;
  const htmlBody = buildTF07EmailHtml(payload, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "TF07",
    cc: cc,
  });
}

function buildTF07EmailHtml(payload, submissionId) {
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

  const basicRows = [
    row("Submission ID", submissionId),
    row("Date", payload.date || ""),
    row(
      "Employee Name",
      `${payload.employee_first_name || ""} ${payload.employee_last_name || ""}`.trim(),
    ),
    row("Employee Email", payload.employee_email || ""),
    row("Team Name", payload.team_name || ""),
    row("Project Name", payload.project_name || ""),
    row("Project Code", payload.project_code || ""),
  ].join("");

  const workRows = [
    row(
      "Type of Work",
      payload.type_of_work === "Other"
        ? payload.type_of_work_other
        : payload.type_of_work,
    ),
    row(
      "Milestone Achieved",
      payload.milestone_achieved === "Other"
        ? payload.milestone_achieved_other
        : payload.milestone_achieved,
    ),
    row("Date of Milestone Achieved", payload.date_of_milestone_achieved || ""),
    row("Proof Link", payload.proof_link || ""),
    row("Submission Status", payload.submission_status || ""),
  ].join("");

  const billRows = [
    row("Person to Bill", payload.person_to_bill || ""),
    row("Email ID of Person to Bill", payload.email_of_person_to_bill || ""),
    row("Remarks", payload.remarks || ""),
  ].join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear Team,</p>
      <p>TF07 has been submitted successfully.</p>

      ${section("Basic Details", basicRows)}
      ${section("Work Details", workRows)}
      ${section("Billing Details", billRows)}

      <p style="margin-top:18px;">Regards,<br/>TF07</p>
    </div>
  `;
}

function sendTF05Email(payload, submissionId) {
  const to = payload.official_email;
  const cc = `info@perfactgroup.in, topmanagement@perfactgroup.in, vc@perfactgroup.in, paromita.das@perfactgroup.in, ${payload.eia_coordinator_email || ""}, ${buildTeamCc(payload.team_name)}`;

  const subject = `Your Format for Handover PPT_EAC Meeting response dated ${payload.date || ""} for ${payload.developer_company_name}, Project ${truncate(payload.project_name || "", 42)} with PCODE- ${payload.project_code || ""} at ${payload.project_location || ""} in ${payload.eac_committee || ""} has been submitted and sent for review`;
  const htmlBody = buildTF05EmailHtml(payload, submissionId);

  GmailApp.sendEmail(to, subject, "HTML email required", {
    htmlBody: htmlBody,
    name: "TF05",
    cc: cc,
  });
}

function buildTF05EmailHtml(payload, submissionId) {
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

  const basicRows = [
    row("Submission ID", submissionId),
    row("Date", payload.date || ""),
    row(
      "Requestor",
      `${payload.requestor_first_name || ""} ${payload.requestor_last_name || ""}`.trim(),
    ),
    row("Official Email", payload.official_email || ""),
    row("Team Name", payload.team_name || ""),
    row("EIA Coordinator", payload.eia_coordinator_name || ""),
    row("QCC Reviewers", payload.qcc_reviewers || ""),
  ].join("");

  const projectRows = [
    row("Developer Company Name", payload.developer_company_name || ""),
    row("Project Name", payload.project_name || ""),
    row(
      "Project Proponent",
      `${payload.project_proponent_first_name || ""} ${payload.project_proponent_last_name || ""}`.trim(),
    ),
    row("Project Code", payload.project_code || ""),
    row(
      "Proposed Project Cost (in lacs)",
      payload.proposed_project_cost_lacs || "",
    ),
    row(
      "Existing Project Cost (in lacs)",
      payload.existing_project_cost_lacs || "",
    ),
    row(
      "Project Cost after getting proposed EC (in lacs)",
      payload.project_cost_after_proposed_ec_lacs || "",
    ),
    row("Project Location", payload.project_location || ""),
    row("Plot Area", payload.plot_area_sq_m || ""),
    row("Built up Area", payload.built_up_area_sq_m || ""),
    row("Capacity", payload.capacity || ""),
    row("EMP Cost (Capital)", payload.emp_cost_capital_lacs || ""),
    row("Category", payload.category || ""),
    row("Activity", payload.activity || ""),
    row("Parivesh Login ID", payload.parivesh_login_id || ""),
    row("Parivesh Password", payload.parivesh_password || ""),
  ].join("");

  const meetingRows = [
    row(
      "Type of Presentation",
      payload.type_of_presentation === "Other"
        ? `${payload.type_of_presentation} | ${payload.type_of_presentation_other || ""}`
        : payload.type_of_presentation || "",
    ),
    row("EAC Committee", payload.eac_committee || ""),
    row("Proposal No.", payload.proposal_no || ""),
    row("Date of uploading", payload.date_of_uploading || ""),
    row("Agenda No.", payload.agenda_no || ""),
    row("Date of EAC meeting", payload.date_of_eac_meeting || ""),
    row("Internal Meeting Link", payload.internal_meeting_link || ""),
    row("EAC Meeting Link", payload.eac_meeting_link || ""),
    row("Meeting S.No.", payload.meeting_s_no || ""),
    row("Master PPT Link", payload.master_ppt_link || ""),
    row("Summarised PPT Link", payload.summarised_ppt_link || ""),
  ].join("");

  const docRows = [
    row(
      "Brief Writeup (Annexure as per Agenda)",
      payload.brief_writeup_annexure || "",
    ),
    row(
      "Uploading Document - Single File Link",
      payload.uploading_document_single_file_link || "",
    ),
    row("Online Report Link", payload.online_report_link || ""),
    row("Undertaking Link", payload.undertaking_link || ""),
    row("KML File Link", payload.kml_file_link || ""),
    row("Backup folder Link", payload.backup_folder_link || ""),
    row(
      "Circulation Documents Link- in Docx",
      payload.circulation_documents_link_docx || "",
    ),
    row(
      "Circulation Documents- in PDF",
      payload.circulation_documents_pdf || "",
    ),
    row("Critical Points", payload.critical_points || ""),
    row("Remarks", payload.remarks || ""),
  ].join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.4;">
      <p>Dear ${payload.requestor_first_name} ${payload.requestor_last_name || ""},</p>
      <p>Your Format for Handover PPT_EAC Meeting response dated ${payload.date || ""} has been submitted successfully</p>

      ${section("Basic Details", basicRows)}
      ${section("Project Details", projectRows)}
      ${section("Meeting / Presentation", meetingRows)}
      ${section("Documents / Links", docRows)}

      <p style="margin-top:18px;">Regards,<br/>TF05</p>
    </div>
  `;
}
