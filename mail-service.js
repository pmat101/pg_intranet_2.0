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
  const ccList = [payload.officialEmail].filter(Boolean).join(",");

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
