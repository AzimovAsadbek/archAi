# Domain model

## Core concepts (slice 1)

- **User** — account with role (`USER`/`ADMIN`), owns projects. Auth via sessions
  (refresh-token rows), see ADR-003.
- **Project** — a residential architecture project. Lifecycle status:
  `DRAFT → CONFIGURED → GENERATING → READY | FAILED`, plus `ARCHIVED` (entered/left via
  explicit archive/unarchive; other transitions computed server-side). Soft-deletable.
- **Configuration blocks** (stored as flat columns, exposed as nested DTO):
  - `land`: areaM2 (authoritative; UI converts sotix = 100 m²), optional widthM/lengthM
  - `house`: widthM, lengthM, floorCount (1–3), style (`HouseStyle`)
  - `features`: garage, terrace, balcony, pool, garden booleans
- **Room** — belongs to a project: type (`RoomType`), 0-based floor index, optional
  widthM/lengthM, optional label, sortOrder. Replaced wholesale on configuration update.

## Domain rules (packages/shared/src/domain)

Errors (block save): house footprint > land area; house side > land side; room on a floor
the house doesn't have; per-floor room area > floor plate.
Warnings (surface, don't block): land area ≠ width×length (>5% off); footprint > 70% of land;
floor > 85% filled; missing kitchen/bathroom; no rooms yet.
`isConfigurationComplete` = land + house + ≥1 room → drives DRAFT↔CONFIGURED.

## Future entities (per roadmap)

ProjectVersion (history/restore), GenerationOperation (state machine + provenance + idempotency),
Asset (generated media, ownership + lifecycle), EstimateRule/PricingPlan (admin-configurable),
BlogPost/FaqItem, AuditLogEntry, Subscription. Keep new domains in their own modules/packages.
