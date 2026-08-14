# Admin panel — specification (v1)

Real operational tooling for the ADMIN role. Server-side RBAC (never UI-only), every
mutation audited. v1 scope: users, projects (read), estimate rules, audit log. Templates,
assets, blog, FAQ, pricing plans arrive with the public-content slice (roadmap).

## Backend (apps/api/src/admin)

- `AdminGuard` (used with the global auth guard): requires `role === 'ADMIN'`, else 403
  `FORBIDDEN`. All routes under `/api/v1/admin/*`. Every admin READ of cross-user data and
  every MUTATION writes an `audit_log` row — explicit, auditable bypass of ownership rules.
- Table `audit_log`: id cuid, actorId (FK users, SetNull on delete → nullable), action
  string (e.g. `user.deactivate`, `estimate-rules.activate`, `users.list`… reads use
  `*.list`/`*.view` sparingly — only cross-user reads), entity string, entityId string?,
  metadata JSONB? (small, no PII beyond ids/emails already visible to admin), createdAt.
  Index (createdAt), (actorId).
- Endpoints (all paginated lists: `page`, `pageSize` ≤ 50, plus filters; zod-validated):
  - `GET /admin/users` — search (email/fullName insensitive), `isActive?` filter; rows:
    id, email, fullName, role, isActive, createdAt, projectCount, aiGenerationCount.
  - `PATCH /admin/users/:id` — body `{ isActive: boolean }`. Cannot deactivate yourself
    (409 `CANNOT_MODIFY_SELF`); cannot modify another ADMIN (409 `CANNOT_MODIFY_ADMIN`).
    Deactivated users fail login (`INVALID_CREDENTIALS` path already checks isActive) and
    their refresh tokens are revoked on deactivation.
  - `GET /admin/projects` — search (name), `status?` filter; rows: id, name, status,
    ownerEmail, roomCount, landAreaM2, updatedAt. Read-only in v1.
  - `GET /admin/estimate-rules` — all versions newest-first: id, version, isActive,
    createdAt, data.
  - `POST /admin/estimate-rules` — body = full `EstimateRules` object (shared zod schema;
    `version` must differ from every existing version, 409 `VERSION_EXISTS`). Transaction:
    deactivate current active, insert new row active. Audited with old/new version meta.
  - `GET /admin/audit` — filters: `action?` prefix, `actorId?`; rows joined with actor
    email (nullable).
- Seed: nothing new (admin user exists). e2e: USER gets 403 on every admin route; ADMIN
  lists users/projects; self-deactivation 409; deactivating demo revokes sessions (their
  refresh then 401s) and login fails; estimate-rules activation switches the active row
  (estimate endpoint total changes accordingly) and rejects duplicate version; audit rows
  written for each mutation with correct actor.

## Web (apps/web — /admin)

- Route group `(admin)` with its own shell: left sidebar (Foydalanuvchilar, Loyihalar,
  Smeta qoidalari, Audit), topbar with back-to-app + user menu. Client guard: `useMe()`
  role !== ADMIN → redirect `/dashboard` (server enforces regardless).
- Users: table (email, name, role badge, status badge, projects, created), search,
  active-filter; row action activate/deactivate with ConfirmDialog; errors localized
  (CANNOT_MODIFY_SELF/CANNOT_MODIFY_ADMIN added to apiErrors).
- Projects: table (name, owner email, status badge, rooms, land m², updated), search +
  status filter. Read-only.
- Estimate rules: active ruleset shown as a structured form (numeric Fields grouped:
  structure/finish/features/shares) prefilled from active data; "Yangi versiya sifatida
  saqlash" requires a new version string; history list beneath (version, active chip,
  date). Client-side validation with the shared `estimateRulesSchema`.
- Audit: table (time, actor email, action, entity, entityId), action filter input,
  pagination. Metadata rendered as compact key:value line when present.
- All strings ×3 locales (`admin.*`); tables responsive (stack or scroll on mobile);
  loading/empty/error states per existing patterns.
