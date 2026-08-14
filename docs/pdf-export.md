# PDF export — specification (v1)

Server-generated project report PDF (pdfkit — deterministic, no headless browser).
Floor plans are drawn natively from the persisted `FloorPlan` geometry (rects/segments),
so the PDF reuses the same data as the 2D/3D tabs. No placeholders: sections render only
when their data exists; the 3D view is not included in v1 (stated honestly in roadmap,
not faked in the document).

## Endpoint

`GET /api/v1/projects/:id/export/pdf` — authenticated, owner-scoped (404 policy),
409 `PROJECT_NOT_CONFIGURED` when configuration incomplete. Streams
`application/pdf`, `Content-Disposition: attachment; filename="archai-<slugified-name>.pdf"`
(ASCII fallback + RFC 5987 UTF-8 name). Throttle 10/min/IP. Generation is synchronous
(<1s); no persistence.

## Document (A4, brand-consistent: paper/ink/terracotta accents, Manrope font bundled
as TTF asset in apps/api/assets/fonts — latin subset covers Uzbek latin)

1. **Cover/header**: archAi wordmark (text), project name, status label, owner name,
   generated date (Asia/Tashkent), project id short.
2. **Configuration summary**: land (m² + sotix, sides when present), house (dims, floors,
   footprint, coverage %, style), features list, rooms table grouped by floor (type,
   label, dims, area, per-floor totals) — localized labels in **uz** for v1 (document
   language follows a `?locale=uz|ru|en` query param, default uz; strings live in a
   small locale map inside the pdf module — 3 locales from day one).
3. **Floor plans**: one page (or half-page) per floor drawn from FloorPlan geometry:
   outline, room fills (light gray tints), walls (line weight by thickness), door arcs,
   window ticks, stairs, room labels + areas, overall dimensions. Scale to fit with a
   printed scale note ("sxematik reja — masshtabsiz").
4. **Estimate** (STANDARD level v1): total + range, cost/m², breakdown table, features,
   rules version, prominent preliminary-estimate disclaimer.
5. **Footer** every page: archAi · generated date · page N/M · disclaimer one-liner.

Reuse services: FloorPlansService (geometry), EstimatesService (calculation), project
mapper. The PDF layer (`apps/api/src/pdf/`) renders only — no business logic.

## Web

Workspace header gains "PDF" action (button with download icon): fetch blob with
credentials → objectURL download (anchor click) → revoke; pending state; error toast/alert
localized; disabled (with tooltip) when project not configured. Locale param = current UI
locale.

## Tests (e2e)

401 unauth; foreign 404; unconfigured 409; configured → 200 with `%PDF-` magic bytes,
content-type, attachment disposition, size > 20KB (plans render), and a second request
byte-identical except metadata (set pdfkit `info` deterministically and disable the
CreationDate variance by fixing it to project.updatedAt so the export is reproducible —
assert byte-identical fully). locale=ru returns 200 and differs from uz output.
