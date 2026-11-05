---
title: Governance, Risk & Compliance (GRC)
category: GRC & Compliance
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# Governance, Risk & Compliance (GRC)

Governance-related capabilities are provided across the standalone risk register, Knowledge Base policy governance, and asset/vendor compliance views. These are related tools, not a single end-to-end GRC framework. The platform does not claim certification against ISO/IEC 27001, NCA, or another regulatory framework.

## Enterprise Risk Register

The `/risks` page provides an organization-level risk register under the `risk_management` feature:

- Record a title, description, category, owner, due date, mitigation, contingency, and status.
- Choose an inherent likelihood and impact from 1–5. The API calculates the inherent score as `likelihood × impact`, displayed on a 5×5 matrix.
- Record optional residual likelihood and impact to show remaining exposure after mitigation.
- Supported categories are Security, Availability, Data, Schedule, Operational, Compliance, Vendor, and Other.
- Statuses are Identified, Mitigating, Accepted, and Closed. Setting a risk to Accepted requires an acceptance reason.
- Risk changes are audit logged. Risk management is independent of Change Management; a legacy nullable change reference in the database is not required by the current risk workflow.

An acceptance reason is not an executive sign-off workflow: the register does not currently route risk acceptance for executive approval or record an approver decision.

## Policy Control Mapping

The Knowledge Base can associate a policy article with a framework name, control ID, control title, and implementation notes. Mappings are version-specific, auditable, and can be removed with a required note.

- Framework and control details are entered as text; there is no pre-populated ISO/NCA control catalog or automated framework assessment.
- Control mappings are currently supported for articles in the Policy, Technical SOP, and DR Plan categories.
- Policy documents can have versioned attachments, but control mappings are not a general-purpose evidence register.

## Compliance Views and Evidence Boundaries

Asset and vendor compliance views provide selected inventory, audit-due, status, and vendor-risk information. These views do not automatically link incident resolutions, CAB votes, or access-review decisions to policy controls. An auditor should use the relevant operational records and attachments alongside the policy mapping; the current system does not provide a single control-to-evidence chain or prove control effectiveness automatically.
