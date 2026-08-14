# API Contract — v1

Base URL: `http://localhost:3001/api/v1`. JSON only. Swagger UI at `/docs` (non-production).

## Conventions

- Auth via httpOnly cookies: `archai_access` (JWT, 15 min), `archai_refresh`
  (opaque random token, 30 days, rotated on every refresh, hash stored in DB).
  Cookies: `SameSite=Lax`, `HttpOnly`, `Secure` when `COOKIE_SECURE=true`;
  refresh cookie is path-scoped to `/api/v1/auth`.
- CORS: origin `WEB_ORIGIN`, `credentials: true`.
- Validation: shared zod schemas (`@archai/shared`) via a Nest `ZodValidationPipe`.
  Schema failure → 400 `{ statusCode: 400, code: 'VALIDATION_ERROR', message, details: zodIssues }`.
- Domain-rule failure → 422 `{ code: 'DOMAIN_VALIDATION_ERROR', details: { errors: DomainIssue[], warnings: DomainIssue[] } }`.
- All errors follow `ApiErrorShape { statusCode, code, message, details? }`.
  Codes: `VALIDATION_ERROR`, `DOMAIN_VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_CREDENTIALS`,
  `EMAIL_TAKEN`, `FORBIDDEN`, `NOT_FOUND`, `PROJECT_ARCHIVED`, `RATE_LIMITED`, `INTERNAL`.
- 404 (not 403) when a resource exists but belongs to another user — do not leak existence.
- Rate limits: global 100 req/min per IP; `auth/login` + `auth/register` 10 req/min per IP.

## Endpoints

### Auth (`/auth`)

| Method | Path | Body (zod) | Response |
|---|---|---|---|
| POST | `/auth/register` | `registerSchema` | 201 `AuthResponse` + cookies. 409 `EMAIL_TAKEN`. |
| POST | `/auth/login` | `loginSchema` | 200 `AuthResponse` + cookies. 401 `INVALID_CREDENTIALS` (same for unknown email — no user enumeration). |
| POST | `/auth/refresh` | — (refresh cookie) | 200 `AuthResponse` + NEW cookies (rotation; old refresh token revoked). 401 if missing/expired/revoked/reused. |
| POST | `/auth/logout` | — | 204, clears cookies, revokes refresh token. Works even when unauthenticated. |

### Users (`/users`) — authenticated

| GET | `/users/me` | — | 200 `UserDto` |

### Projects (`/projects`) — authenticated, owner-scoped

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/projects` | query `listProjectsQuerySchema` | 200 `Paginated<ProjectListItemDto>` — only own, non-deleted; `search` matches name (insensitive); sorted by `updatedAt` desc. |
| POST | `/projects` | `createProjectSchema` | 201 `ProjectDto` (status DRAFT) |
| GET | `/projects/:id` | — | 200 `ProjectDto` (includes rooms + fresh `validation`) |
| PATCH | `/projects/:id` | `updateProjectSchema` | 200 `ProjectDto`. Provided blocks replace stored blocks (rooms wholesale, in given order → `sortOrder`). Reject with 422 if domain validation yields errors. After update: status DRAFT→CONFIGURED when `isConfigurationComplete`; CONFIGURED→DRAFT when it stops being complete. ARCHIVED projects reject updates (409 `PROJECT_ARCHIVED`). |
| DELETE | `/projects/:id` | — | 204 (soft delete: sets `deletedAt`; excluded everywhere) |
| POST | `/projects/:id/archive` | — | 200 `ProjectDto` (status ARCHIVED) |
| POST | `/projects/:id/unarchive` | — | 200 `ProjectDto` (status recomputed DRAFT/CONFIGURED) |
| POST | `/projects/:id/duplicate` | — | 201 `ProjectDto` (copy incl. rooms, name suffix " (nusxa)", status recomputed) |

### Floor plan (`/projects/:id/floor-plan`) — authenticated, owner-scoped

| GET | `/projects/:id/floor-plan` | — | 200 `{ plan: FloorPlan, generatedAt }`. Deterministic engine output persisted in `floor_plans` (regenerated when config inputHash or engine version changes). 409 `PROJECT_NOT_CONFIGURED` when configuration incomplete; 422 `FLOOR_PLAN_UNAVAILABLE` `{ details: { issues } }` when the engine rejects the configuration. Full contract: docs/floor-plan-engine.md §Consumers. |

### Meta

| GET | `/health` | — | 200 `{ status: 'ok', db: 'up' \| 'down' }` (no auth) |

## DTO mapping

`ProjectDto.land/house/features` are assembled from the flat Prisma columns
(`land` is null unless `landAreaM2` is set; `house` null unless all of
`houseWidthM`,`houseLengthM`,`floorCount` set). `validation` =
`validateProjectConfiguration(config)` computed on read. Never return
`passwordHash`, `deletedAt`, or other users' data.
