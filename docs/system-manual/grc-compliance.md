---
title: Governance, Risk & Compliance (GRC)
category: GRC & Compliance
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.1.0
audience: internal
---

# Governance, Risk & Compliance (GRC)

Governance-related capabilities are provided across the standalone risk register, Knowledge Base policy governance, and asset/vendor compliance views. These are related tools, not a single end-to-end GRC framework. The platform does not claim certification against ISO/IEC 27001, NCA, or another regulatory framework.

## Internal IT Department Risk Register

The `/risks` page is the **Internal IT Department Risk Register**, under the `risk_management` feature. It is separate from Project Management and project-specific risks.

- Each risk has an `IT-RSK-xxx` reference and belongs to one of seven internal IT domains.
- Record inherent, residual and target 1–5 likelihood/impact assessments; switch the interactive 5×5 matrix between those stages and select a cell to filter records.
- Assess CIA impact, threats, vulnerabilities, existing controls and control effectiveness.
- Choose Mitigate, Accept, Transfer or Avoid; track concrete engineering mitigation actions with owners, due dates, evidence and completion timestamps.
- Residual exposure is compared with the configurable IT Risk Appetite (default 12). Acceptance at or above the threshold requires justification, a future expiry and a recorded operator sign-off with actor/timestamp.
- Link optional internal infrastructure, assets, vendors, compliance reviews, problems and changes; spawn linked internal changes/problems when ITSM is enabled. No project association is required or offered.
- Record periodic reviews with automatic next-review advancement and score/status history; export filtered CSV and Executive PDF reports.

Read the **Internal IT Department Risk Management Guide** in **Knowledge Base → User Guides** for the complete workflow. Acceptance records an authorized operator's decision; it does not route a separate executive approval request or replace organizational approval policy.

## Policy Control Mapping

The Knowledge Base can associate a policy article with a framework name, control ID, control title, and implementation notes. Mappings are version-specific, auditable, and can be removed with a required note.

- Framework and control details are entered as text; there is no pre-populated ISO/NCA control catalog or automated framework assessment.
- Control mappings are currently supported for articles in the Policy, Technical SOP, and DR Plan categories.
- Policy documents can have versioned attachments, but control mappings are not a general-purpose evidence register.

## Compliance Views and Evidence Boundaries

Asset and vendor compliance views provide selected inventory, audit-due, status, and vendor-risk information. These views do not automatically link incident resolutions, CAB votes, or access-review decisions to policy controls. An auditor should use the relevant operational records and attachments alongside the policy mapping; the current system does not provide a single control-to-evidence chain or prove control effectiveness automatically.
