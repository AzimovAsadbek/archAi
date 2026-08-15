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
| PATCH | `/projects/:id` | `updateProjectSchema` | 200 `ProjectDto`. Provided blocks replace stored blocks (rooms wholesale, in given order → `sortOrder`). `layoutStrategy` (BALANCED\|COMPACT\|OPEN\|PRIVACY\|FAMILY, null = BALANCED default) selects the layout-optimization policy — it is part of the floor-plan cache key, so changing it regenerates the plan. Reject with 422 if domain validation yields errors. After update: status DRAFT→CONFIGURED when `isConfigurationComplete`; CONFIGURED→DRAFT when it stops being complete. ARCHIVED projects reject updates (409 `PROJECT_ARCHIVED`). |
| DELETE | `/projects/:id` | — | 204 (soft delete: sets `deletedAt`; excluded everywhere) |
| POST | `/projects/:id/archive` | — | 200 `ProjectDto` (status ARCHIVED) |
| POST | `/projects/:id/unarchive` | — | 200 `ProjectDto` (status recomputed DRAFT/CONFIGURED) |
| POST | `/projects/:id/duplicate` | — | 201 `ProjectDto` (copy incl. rooms, name suffix " (nusxa)", status recomputed) |

### Floor plan (`/projects/:id/floor-plan`) — authenticated, owner-scoped

| GET | `/projects/:id/floor-plan` | — | 200 `{ plan: FloorPlan, generatedAt, layout: { strategy, score: { total, components[] } } }`. Deterministic engine output persisted in `floor_plans` (regenerated when config inputHash or engine version changes); `layout` is the explainable quality score, recomputed from the plan on every read (pure + deterministic, never persisted) — components are `{ code, score 0..1, weight }`, localized by code. 409 `PROJECT_NOT_CONFIGURED` when configuration incomplete; 422 `FLOOR_PLAN_UNAVAILABLE` `{ details: { issues, suggestions? } }` when the engine rejects the configuration or the feasibility gate fails (`INFEASIBLE_REQUIREMENTS`). Full contract: docs/floor-plan-engine.md §Consumers. |

### AI (`/ai`) — authenticated

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/ai/parse-project` | `{ text: string (trim 5..2000), localeHint?: 'uz'\|'ru'\|'en' }` | 200 `AiParseProjectResponse { proposal, validation, provenance }` (shared types). Throttled 10/min/IP + a per-user daily quota (`AI_MAX_REQUESTS_PER_USER_PER_DAY`). Never creates/modifies projects — applying is the client's explicit follow-up via POST /projects + PATCH. Errors (ApiErrorShape): 503 `AI_NOT_CONFIGURED`, 429 `AI_RATE_LIMITED`/`AI_QUOTA_EXCEEDED` (or `RATE_LIMITED` from the throttler), 502 `AI_PROVIDER_ERROR`/`AI_TIMEOUT`, 422 `AI_REFUSED`/`AI_INVALID_OUTPUT`, 400 `VALIDATION_ERROR` (keys `ai_text_min`/`ai_text_max`). Contract details: docs/ai-architecture.md. |
| POST | `/ai/projects/:id/suggest` | `{ focus?: string (trim ≤500), localeHint? }` | 200 `AiSuggestResponse { suggestions: { detectedLanguage, summary, suggestions[] }, provenance }`. Advisory design suggestions for an **owned** project (loaded server-side from the id); never mutates it. Same throttle + daily quota + AI error contract as parse-project; 404 `NOT_FOUND` when the project is not the caller's. |
| POST | `/ai/projects/:id/ask` | `{ question: string (trim 3..500), localeHint? }` | 200 `AiAnswerResponse { answer: { detectedLanguage, addressable, answer }, provenance }`. Grounded Q&A about an **owned** project; `answer.addressable` is false for off-topic / out-of-scope / injection questions (the answer is then a safe redirect). Same throttle + quota + errors; 404 when not owned; 400 keys `ai_question_min`/`ai_question_max`. |
| GET | `/ai/status` | — | 200 `{ provider, available, fallbackProvider, fallbackAvailable, primaryModel, dailyRequestLimitPerUser }` — secrets-free runtime-AI diagnostic (never returns keys). |

### Estimate — authenticated, owner-scoped

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/projects/:id/estimate` | `finishLevel? = STANDARD\|COMFORT\|PREMIUM` (default STANDARD) | 200 `{ estimate: EstimateResult }` (deterministic, computed on read; throttle 30/min). 409 `PROJECT_NOT_CONFIGURED`; 400 `VALIDATION_ERROR` (bad finishLevel); active-rules fault → generic 500 `INTERNAL` (logged `ESTIMATE_RULES_MISSING`). Full contract: docs/estimate.md. |

### PDF export — authenticated, owner-scoped

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/projects/:id/export/pdf` | `locale? = uz\|ru\|en` (default uz) | 200 `application/pdf` (attachment, RFC 5987 filename; deterministic; throttle 10/min). 409 `PROJECT_NOT_CONFIGURED`; 400 `VALIDATION_ERROR` (bad locale). Full contract: docs/pdf-export.md. |

### Admin (`/admin/*`) — authenticated + ADMIN (AdminGuard); every mutation and cross-user read audited

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users` | Paginated; search + `isActive` filter; project/AI counts. |
| PATCH | `/admin/users/:id` | `{ isActive }`; 409 `CANNOT_MODIFY_SELF` / `CANNOT_MODIFY_ADMIN`; deactivation revokes refresh tokens. |
| GET | `/admin/projects` | Paginated cross-user list (read-only), search + status filter. |
| GET/POST | `/admin/estimate-rules` | List versions / create-and-activate (`EstimateRules` body; 409 `VERSION_EXISTS`). |
| GET | `/admin/audit` | Paginated; `action` prefix + `actorId` filters. |
| GET/POST/PATCH/DELETE | `/admin/faq[/:id]` | FAQ CRUD. |
| GET/POST/PATCH/DELETE | `/admin/blog[/:id]` | Blog CRUD; 409 `SLUG_EXISTS`; publish stamps `publishedAt`. |
| GET/POST/PATCH | `/admin/pricing[/:id]`, `/admin/pricing/:id/deactivate` | Pricing CRUD; 409 `CONFLICT` (dup key). |

Detail: docs/admin.md, docs/public-content.md.

### Public content (`/faq`, `/blog`, `/pricing`) — no auth

| Method | Path | Response |
|---|---|---|
| GET | `/faq` | `{ items: FaqItemDto[] }` (published, grouped by category). |
| GET | `/blog` | `Paginated<BlogListItemDto>` (published, newest first; category/tag filter). |
| GET | `/blog/:slug` | `BlogPostDto` (404 for draft/unknown/malformed slug). |
| GET | `/pricing` | `{ plans: PricingPlanDto[], beta: true }` (active plans). |

Detail: docs/public-content.md.

### Meta

| Method | Path | Response |
|---|---|---|
| GET | `/health` | 200 `{ status: 'ok', db: 'up' \| 'down' }` — liveness, always 200 (no auth). |
| GET | `/ready` | 200 when the database is reachable, **503 `NOT_READY`** otherwise (no auth) — for orchestrator/LB health checks. |

## DTO mapping

`ProjectDto.land/house/features` are assembled from the flat Prisma columns
(`land` is null unless `landAreaM2` is set; `house` null unless all of
`houseWidthM`,`houseLengthM`,`floorCount` set). `validation` =
`validateProjectConfiguration(config)` computed on read. Never return
`passwordHash`, `deletedAt`, or other users' data.
