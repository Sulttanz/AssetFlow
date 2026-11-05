---
title: PMP Project Control & PMI RMP Risk Register
category: Project Management & Governance
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# PMP Project Control & PMI RMP Risk Register

The Project Management workspace provides controls that can support PMP- and PMI RMP-aligned practices. The features described here do not certify that an organization's complete project methodology conforms to PMI standards.

## Project Execution & Workload Reporting

- **Task board**: Tasks use the workflow states `Backlog`, `To Do`, `In Progress`, `In Review`, and `Done`. Task records can include assignees, estimated hours, and logged hours.
- **Resource allocation report**: The portfolio report summarizes users, their projects, assigned task counts, and estimated/logged task hours. It is a reporting view; it does not prevent double-booking or enforce resource capacity.
- **Milestones**: Milestone records track project phases, dates, and status. They are not configured as blocking completion gates for dependent tasks.
- **Earned-value indicators**: The project overview presents lightweight PV, EV, and AC indicators. PV is calculated as budget times elapsed schedule; EV is budget times completed work; AC is recorded actual spend.

## Versioned Project Baselines & Variance

Authorized project managers and administrators can lock a project baseline after explicitly confirming plan approval. Baselines are versioned (`v1.0`, `v1.1`, and so on) and snapshot the project's budget, start date, target end date, approving user, creation timestamp, and revision note.

The workspace compares current project values with the selected baseline:

- **Budget variance** is baseline budget minus recorded actual spend. A positive value is under budget; a negative value indicates overspend.
- **Schedule variance** is shown in days by comparing the baseline target end date with the current actual end date, or the current target end date when no actual end date is recorded. Positive values mean ahead of baseline; negative values mean behind.

These date and cost comparisons are project-control indicators; schedule variance is not calculated as earned value minus planned value.

## Project Risk Register

### Inherent Risk Score

Each risk requires a probability and impact rating from 1 through 5. The database calculates the inherent score as `probability × impact`, producing a score from 1 to 25. Supported categories include Technical, Financial, Operational, Schedule, and Compliance.

### Residual Exposure and Response

Risks can record residual probability and impact after mitigation. Each residual value is optional and, when supplied, must be from 1 through 5. The form also supports an owner, mitigation strategy, contingency plan, and review date; these fields are optional in the current implementation. There is a review date field, but not a separate review-frequency field.

Project risk creation, updates, and deletion are recorded in the audit log. Project managers manage risk records; assigned risk owners can update response details, residual exposure, review date, and status.
