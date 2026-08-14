# Public content & pricing — specification (v1)

Public marketing/content surface + the domains behind it. Honesty first: pricing is
"free during beta" with NO payment integration (never pretend payments exist); plans are
modeled as data for the future but presented as beta. Blog + FAQ are real DB-backed
domains with admin CRUD.

## Domains (apps/api + prisma)

### FAQ
- Table `faq_items`: id cuid, question, answer (plain text/markdown-ish, rendered as
  paragraphs — NOT html), category string?, sortOrder int, isPublished bool, timestamps.
- Public: `GET /api/v1/faq` → published items, ordered by (category, sortOrder). No auth.
- Admin (under existing AdminGuard): `GET /admin/faq` (all), `POST /admin/faq`,
  `PATCH /admin/faq/:id`, `DELETE /admin/faq/:id` (hard delete ok — content). Audited.
- Seed: 6–8 realistic uz FAQ items (what archAi does, is the estimate accurate, is it a
  construction document, languages, data privacy, is it free).

### Blog
- Table `blog_posts`: id cuid, slug (unique), title, excerpt, body (markdown, rendered
  SAFELY — no raw html; use a minimal safe markdown renderer or paragraph/heading split),
  authorName, category string?, tags string[] (Postgres text[]), coverImageUrl string?,
  status enum DRAFT|PUBLISHED, publishedAt DateTime?, seo (metaTitle?, metaDescription?),
  timestamps.
- Public: `GET /api/v1/blog` (published, paginated, newest publishedAt first; optional
  category/tag filter) → list items (slug,title,excerpt,cover,author,category,publishedAt);
  `GET /api/v1/blog/:slug` → full published post (404 if draft/missing).
- Admin: `GET /admin/blog` (all incl. drafts, paginated), `POST /admin/blog`,
  `PATCH /admin/blog/:id` (publish sets publishedAt if transitioning to PUBLISHED and unset),
  `DELETE /admin/blog/:id`. slug uniqueness → 409 SLUG_EXISTS. Audited.
- Seed: 2–3 published posts (uz) about home planning / reading an estimate / choosing a style.

### Pricing (data-modeled, presented as beta-free)
- Table `pricing_plans`: id cuid, key (unique: FREE|BASIC|PRO), name, tagline, priceMonthly
  int (UZS, 0 for free), limits JSONB { projects:int|null, aiParsesPerMonth:int|null,
  pdfExportsPerMonth:int|null, storageMb:int|null } (null = unlimited), features string[]
  (display bullet keys), sortOrder, isActive, timestamps.
- Public: `GET /api/v1/pricing` → active plans ordered. Admin CRUD under /admin/pricing
  (create/update/deactivate; limits enforcement is NOT wired in v1 — plans are informational).
  Audited.
- Seed: FREE (0, current beta — "hozircha hammasi bepul"), BASIC, PRO with sensible limits,
  all marked with a beta note server-side via a `betaNotice: true` flag on the pricing
  response envelope `{ plans, beta: true }`.

Shared: zod schemas + DTO types for faq/blog/pricing in packages/shared (public shapes)
so web is typed. Admin input schemas may live in the api admin module.

## Web (apps/web)

Public pages under the (marketing) group (server components, SEO metadata via
generateMetadata, all localized uz/ru/en — content itself is stored in one language per row
for v1; UI chrome localized):
- `/pricing`: plan cards (name, tagline, price with "bepul (beta)" for free, feature
  bullets, limits table), prominent honest beta banner ("Hozircha barcha imkoniyatlar
  bepul. To'lov tizimi hali ulanmagan."), CTA → register. NO fake checkout.
- `/blog`: post grid (cover, title, excerpt, author, date, category), category filter,
  pagination; `/blog/[slug]`: article (cover, title, meta, author, date, safe-rendered
  body, tags), back to blog, per-post SEO metadata + Open Graph. Draft slug → notFound().
- `/faq`: grouped by category, accessible accordion (native details/summary or a
  keyboard-accessible disclosure), search filter.
- `/help` + `/about`: static localized content pages (mission, how it works recap, contact
  placeholder — no fake form submission; a mailto or static contact note).
- Marketing header/footer gain nav links to pricing/blog/faq/help/about.
- Admin UI: add Blog, FAQ, Pricing sections to the existing /admin sidebar with list +
  create/edit forms (markdown textarea for blog body with a live-ish preview optional;
  slug auto-suggest from title; publish toggle). Reuse admin-table patterns.

SEO: `app/sitemap.ts` (marketing + published blog slugs), `app/robots.ts`
(allow all, sitemap ref). JSON-LD Article on blog posts. Canonical URLs.

## Safety & honesty rules

- Blog body is markdown from admins (trusted-ish) but STILL rendered without raw HTML
  injection — use a safe renderer (react-markdown with html disabled, or a minimal
  paragraph/heading/list/link/bold/italic parser). No dangerouslySetInnerHTML with raw input.
- Never render a checkout/payment UI. Pricing is informational + beta-free.
- Contact: no form that pretends to send; mailto or a static address only.

## Tests

- shared: pricing/blog/faq public schema fixtures.
- api e2e: public GET faq/blog/blog:slug/pricing (published-only visibility, draft 404,
  slug 404); admin CRUD (auth/403, create/update/delete, slug 409, publish sets
  publishedAt, audit rows). Keep suites green.
