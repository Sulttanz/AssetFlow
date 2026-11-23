---
title: Internal IT Department Risk Management Guide
category: GRC & Compliance
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: all_authenticated
---

# Internal IT Department Risk Management Guide

## Scope, access and separation from project risks

Open **Risk Management & Compliance → Risk Register** ([/risks](/risks)). This register tracks internal IT Department operational, security, infrastructure, vendor and compliance risks. Each saved risk receives a unique sequential reference such as **IT-RSK-001**. Numbers are allocated by the database; cancelled or rolled-back operations can leave gaps, and references are not recycled by a data reset.

This is **not** the Project Management risk register. Project-specific risks belong in the relevant project workspace and its project risk register. The internal IT register has no Project field, project membership requirement or dependency on `projects` / `project_risks`. Linking an internal IT risk to a Change Request does not create a project association.

The operational register requires the **Risk Management** feature and appropriate permissions. Authorized risk/change managers and System Administrators manage assessments; permitted compliance/audit readers inspect and export them without authoring controls. All authenticated users may read this published System Manual guide, even when they cannot open the operational register. Reading documentation does not grant operational permissions.

## Creating and assessing an IT risk

1. Select **Create IT risk** and enter a clear risk title.
2. Select one of the seven IT operational categories and assign an accountable risk owner.
3. In **Assessment & scoring**, describe the threat, the vulnerability it could exploit, existing controls and the affected CIA properties.
4. Enter likelihood and impact scores from **1 (very low) to 5 (severe)**. Use consistent departmental scoring criteria and explain assumptions in the description.
5. Complete the treatment and review information, then select **Save risk assessment**.

### The seven IT risk domains

| Category | Typical internal IT concerns |
|---|---|
| Infrastructure & High Availability | Single points of failure, power, capacity and failover readiness. |
| Cybersecurity & Vulnerability | Malware, exposed services, exploitation and ineffective endpoint protection. |
| Backup, DR & Continuity | Failed backups, untested restores, retention gaps and recovery capability. |
| Identity, Access & Patching | Excessive access, overdue revocation, weak identity controls and patch debt. |
| Third-Party & Vendor | Unsupported systems, supplier dependency, expiring support and vendor service failures. |
| Service Delivery & ITSM | Incident response, service capacity, knowledge gaps and unsafe operational changes. |
| Regulatory & Compliance | Missing evidence, policy exceptions, review gaps and applicable regulatory obligations. |

**Threat source** describes who or what could cause harm; **Vulnerability** describes the weakness that permits it. Select **Confidentiality**, **Integrity** and/or **Availability** under **CIA impact** to show what could be affected. These flags describe consequences; they do not automatically calculate the risk score.

Record the **Existing controls** and rate **Control effectiveness** as **Effective**, **Partially Effective** or **Ineffective**. These are evidence-based assessments by the responsible team, not automated security-test results.

## Three-stage scoring and the 5 × 5 IT Risk Matrix

Every stage uses **likelihood × impact**, producing a score from **1 to 25**:

| Stage | Meaning | Practical use |
|---|---|---|
| Inherent Risk | Raw exposure before controls are considered. | Understand the original severity of the threat. |
| Residual Risk | Current exposure with existing IT controls in place. | Compare today's exposure with the configured IT Risk Appetite. |
| Target Risk | Expected exposure after planned mitigation actions are completed and verified. | Describe the intended outcome; it is not proof that mitigation has succeeded. |

Enter both components for a residual or target assessment, or leave both blank. Blank residual values fall back to inherent exposure, avoiding an assumption that an unassessed risk is safe. Blank target values are shown as unassessed and excluded from Target matrix cells.

Use **Inherent Risk**, **Residual Risk** or **Target Risk** above the matrix to switch the plotted stage. Each cell displays the number of risks with that exact impact and likelihood. Click a cell to filter the register below; the active-filter pill shows the selected coordinates. Select **Clear matrix filter**, click the selected cell again, or switch modes to remove that cell filter.

Search, category and status filters also apply. Matrix counts follow those filters; a selected matrix cell further restricts the table and exports. The executive KPI cards summarize the full accessible register, not only the currently filtered table.

### Executive indicators

- **Total IT Risks:** all registered internal IT risks.
- **Active Mitigation Actions:** action items not marked Completed, including outstanding actions on closed risks.
- **Above Risk Appetite:** non-closed risks whose residual exposure is at or above the configured threshold.
- **Overdue Reviews / Actions:** overdue reviews of non-closed risks plus overdue incomplete action items.
- **Pending / Expiring Acceptances:** non-closed Accept risks with missing sign-off/expiry information, expired acceptance, or acceptance expiring within 30 days. This is an attention indicator, not a separate approval inbox.

## Treatment, engineering actions and acceptance

In **Treatment & actions**, choose a 4T strategy:

- **Mitigate:** reduce likelihood or impact through technical or procedural controls.
- **Accept:** retain exposure with a documented, accountable decision.
- **Transfer:** allocate aspects of exposure contractually, for example through a support agreement; ownership and oversight are still necessary.
- **Avoid:** stop or redesign the activity that creates the exposure.

Record the mitigation plan, contingency plan and treatment due date. Strategy labels document the decision; selecting one does not automatically modify infrastructure, purchase insurance or close related tickets.

### Mitigation Action Items

Save the risk before adding actions. Use **Add action** to record a specific engineering task, owner, due date and evidence notes. Track **Open**, **In Progress**, **Completed** or **Overdue** work; incomplete actions past their due date appear as Overdue.

Use **Edit** to revise a task or evidence, and **Complete** when the work is verified. Completion stamps the action's completion timestamp; reopening clears it. Completing actions does not automatically lower risk scores: reassess residual exposure and save the assessment after validating the controls.

### IT Risk Appetite and time-limited Risk Acceptance

The default appetite threshold is **12**, configurable through the risk appetite settings control by authorized managers. The register uses **residual score ≥ threshold** for its Above Risk Appetite indicator and acceptance validation.

When **Accept** is selected at or above that threshold, saving requires:

- A meaningful **Acceptance justification**.
- A future **Acceptance expires** date.
- A server-recorded **acceptedByUserId** and **acceptedAt**, identifying the authenticated person saving the sign-off.

The approver/signatory identity and timestamp are not manually entered or supplied by the browser. Revising acceptance terms or exposure records a new sign-off; unrelated edits do not silently replace an existing signatory. An Accepted status also requires justification. Selecting a different treatment clears the active acceptance fields.

This is a recorded sign-off by an authorized operator, **not** a separate executive approval-routing workflow. Follow your organization's approval and delegation policy before recording acceptance. Expired or soon-expiring decisions require review, renewed justification/expiry, mitigation, or another appropriate treatment.

## Linked IT records and follow-up workflows

In **Linked IT records**, choose a record type and attach an existing:

- CMDB Application or Server.
- Network Device.
- Asset or Vendor.
- IT Component Compliance Review.
- Problem or internal IT Change Request.

These are optional associations. Disabled supporting modules expose no selectable records; they are not required to create, assess or review an internal IT risk. Project-specific changes cannot be newly linked here.

When ITSM is enabled, **Spawn Change Request** or **Spawn Problem** in the treatment tab creates a pre-filled internal IT follow-up and links it back to the risk. A spawned change is a draft normal change requiring its normal review/CAB process; spawning does not approve or implement it. Repeating the same spawn action reuses that risk's generated record rather than duplicating it. No Project Task or project-linked risk is created.

## Periodic reviews and audit history

In **Review & audit history**:

1. Select **Monthly**, **Quarterly**, **Semi-Annual** or **Annual** review frequency and save changes.
2. Record review sign-off notes and select **Mark Reviewed Today**.
3. The server stamps **Last reviewed** and advances **Next review date** by 1, 3, 6 or 12 calendar months. Month-end dates are clamped to the last valid day.
4. Inspect the recorded score/status history and reviewer. Reassess scores explicitly when controls or conditions change; signing a review does not itself alter exposure scores.

Assessment, action, link, spawn and review mutations are audit logged. Assessment/review changes and their audit writes commit together, so an audit-storage failure cannot silently leave an unaudited successful change. Human-facing dates use **DD-MM-YYYY**.

## CSV and Executive PDF reports

Apply search, category, status and optional matrix-cell filters, then select **Export CSV** or **Executive IT Risk Report (PDF)**. Reports include the filtered risk summary, the selected matrix-mode summary and overdue actions for those risks. Clear filters first for a register-wide report.

Exports are snapshots for review, not independent compliance certification. The register supports documented risk assessment and evidence practices associated with ISO 27005, ISO 27001, ISO 22301, NCA and SAMA; organizational policies, control testing and formal assurance remain necessary.

## What a system data reset does

**Clear All System Data** deletes internal IT risks, mitigation actions, review history and risk-link records together with other operational data. It preserves this repository-managed guide and the configured appetite setting. Consult the **System Administration, RBAC & Data Reset Guide** before any reset.
