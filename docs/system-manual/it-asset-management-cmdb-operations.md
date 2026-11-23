---
title: IT Asset Management & CMDB Operations
category: My Assets & ITAM / CMDB
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# IT Asset Management & CMDB Operations

The platform provides related, separately gated capabilities for physical and software asset tracking, consumable stock, and infrastructure configuration records. Asset Management and CMDB can be enabled independently; workflows that span them are available only when their required modules are enabled.

## IT Asset Management (ITAM)

### 1. Hardware and Software Asset Records

Asset records can capture:

- **Identification**: Name, asset tag, type, category, serial number, model, and manufacturer.
- **Technical and security details**: Operating system, IP and MAC addresses, endpoint-protection status, compliance status, and configuration baseline.
- **Lifecycle and financial details**: Purchase/acquisition dates, purchase price, warranty dates, maintenance details, and operational status.
- **Software licensing**: License type, quantity, expiry date, and per-employee seat allocations.

Custodian relationships are recorded through employee assignments and asset handovers. Location is tracked on the asset record.

### 2. Supporting ITAM Registers

- **Licenses and software seats**: Track license type, expiry, purchased/used seats, and employee allocations. Reassign or reclaim seats through the supported license workflow.
- **Accessories and consumables**: Record stock by warehouse, receipts, issues, transfers, and audited manual adjustments. Disabled warehouses are excluded from new stock operations while historical movements remain available.
- **Vendors and contracts**: Maintain supplier contacts, linked assets, vendor certifications, service/support contracts, renewal dates, and performance information where configured.
- **Locations and departments**: Use shared organizational reference data to group employee and asset records.
- **Employee custody**: Asset handovers record issue/return condition and acknowledgement. Returned equipment updates its assignment and asset status through the handover workflow.

### 3. Maintenance

Maintenance schedules associate an asset with a type, frequency, next due date, priority, and estimated cost. Maintenance records capture completed work, technician or vendor, actual cost, and notes.

### 4. Consumable Stock

Consumable quantities are tracked per active warehouse, with category, part number, minimum reorder level, and unit cost. Stock movements record receipts, issues, and transfers. Service-request dispatch records are linked to the request and requester; the current dispatch model does not directly allocate stock to a project.

## Configuration Management Database (CMDB)

The CMDB provides separate registers for applications, servers, network devices, and backup schedules.

### Application-to-Server Relationships

The `application_server_links` table relates application records to server records. Server management allows staff to select hosted applications, and application views show linked infrastructure. This is an explicit application/server relationship; it does not automatically model every possible network or service dependency.

### Change Impact Analysis

When both ITSM and CMDB are enabled, change requests can link target applications and servers. The change impact summary includes directly selected targets, related servers or applications found through `application_server_links`, and the affected applications' recorded business and technical owners.

This computed blast-radius summary is part of Change Management. Do not assume the same application/server impact analysis is automatically calculated for incident records.

## Module Availability

- **Asset Management** controls the asset, employee administration, maintenance, consumables, and related financial capabilities.
- **CMDB** controls application, server, network, and backup registers.
- **Change impact analysis** requires both ITSM and CMDB.

Disabled modules hide their UI and reject their APIs while preserving stored records and relationships.
