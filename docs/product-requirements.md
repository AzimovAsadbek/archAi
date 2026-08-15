# Product Requirements (condensed)

**Promise:** turn land information and user requirements into a structured, understandable,
visual home project — an architecture product with AI assistance, not an image generator.

## Users & journey

Homeowners/self-builders in Uzbekistan (uz primary; ru/en). Journey:
Landing → Register/Login → New project → Configure (Land → House → Floors → Rooms →
Features → Style) or describe in natural language → AI proposal → review/edit →
Project workspace (Overview | 2D | 3D | Interior | Exterior | Estimate) → Save → Export PDF.

The user must always see: current step, what is valid/missing, save state, generation progress.

## Feature areas (build order = roadmap slices)

1. **Auth**: register, login, logout, refresh, profile; secure sessions; RBAC (USER/ADMIN).
2. **Projects**: CRUD, soft delete, archive, duplicate, status lifecycle, later versioning.
3. **Configuration**: land (sotix/m², dimensions), house dims, floors 1–3, rooms
   (type/floor/dims), features (garage/terrace/balcony/pool/garden), style.
4. **AI assistance**: NL → validated structured config proposal (never auto-applied);
   prompt-injection-safe; provenance recorded; provider-abstracted (free-tier-first: Gemini + Groq).
5. **2D**: deterministic floor-plan engine → SVG viewer (pan/zoom/floors/labels/dimensions).
6. **3D**: derived from structured data (R3F): walls/floors/openings/roof/camera.
7. **Concepts**: exterior/interior image generation as *concepts*, stored assets w/ metadata.
8. **Estimate**: deterministic, rule-based, admin-configurable; clearly labeled an estimate.
9. **Export**: professional PDF (summary, plans, concepts, estimate).
10. **Public site**: landing, pricing, blog, FAQ, help, about. SEO.
11. **Admin**: users, projects, templates, assets, pricing, blog, FAQ, estimate rules, audit log.
12. **Subscriptions**: Free/Basic/Pro limits, provider-independent payments (only when real).

## Non-functional

Responsive (desktop/tablet/mobile first-class), accessible (WCAG-minded), localized (uz/ru/en),
secure (server-side authz, object-level ownership, rate limits, no secret leaks), observable
(structured logs, request IDs, /health), tested (unit + integration + E2E), honest states
(loading/empty/error everywhere). Premium, restrained architectural visual language.
