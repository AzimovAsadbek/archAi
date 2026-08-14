# Estimate engine — specification (v1)

Deterministic, rule-based construction cost estimation. **AI never invents prices.**
Rules are data (admin-editable in slice 8, seeded now); calculation is a pure function in
`packages/shared` used by the API. Currency: UZS. Every surface communicates clearly that
this is a *preliminary estimate*, not a construction document.

## Rule model (zod `estimateRulesSchema` in packages/shared)

```ts
EstimateRules = {
  version: string;              // e.g. '1' — echoed in responses as provenance
  currency: 'UZS';
  structureCostPerM2: number;   // foundation+frame+walls+roof, per gross floor m²
  finishCostPerM2: { STANDARD: number; COMFORT: number; PREMIUM: number };
  extraFloorFactor: number;     // multiplier per floor above the first on structure
                                // cost of that floor's area, e.g. 1.08
  features: { garage: number; terrace: number; balcony: number; pool: number; garden: number };
                                // flat UZS amounts (garden scales: amount per 100 m² of land)
  laborShare: number;           // 0..1 of (structure+finish) reported as labor line
  contingencyShare: number;     // 0..1 applied to subtotal, e.g. 0.1
  rangeShare: number;           // ± band, e.g. 0.15
}
```

Seed defaults (apps/api/prisma/seed.ts — realistic 2026 Uzbekistan ballpark, clearly
adjustable): structure 3_500_000 UZS/m², finish STANDARD 2_000_000 / COMFORT 3_200_000 /
PREMIUM 5_000_000 UZS/m², extraFloorFactor 1.08, garage 60_000_000, terrace 25_000_000,
balcony 15_000_000, pool 120_000_000, garden 8_000_000 per 100 m² land, laborShare 0.35,
contingencyShare 0.10, rangeShare 0.15.

## Calculation (pure, `calculateEstimate(config, rules, finishLevel)` in shared)

Quantities from the project configuration (floor-plan geometry not required):
- grossFloorAreaM2 = houseW × houseL × floorCount
- structure = Σ per floor: footprint × structureCostPerM2 × (floor === 0 ? 1 : extraFloorFactor)
- finish = grossFloorAreaM2 × finishCostPerM2[finishLevel]
- features = Σ enabled feature amounts (garden: amount × landAreaM2/100, rounded)
- materialsAndWorks = structure + finish; labor line = materialsAndWorks × laborShare
  (presentation split: materials line = materialsAndWorks × (1 − laborShare))
- contingency = (materialsAndWorks + features) × contingencyShare
- total = materialsAndWorks + features + contingency
- range = [total × (1 − rangeShare), total × (1 + rangeShare)]; costPerM2 = total / grossFloorAreaM2

Output `EstimateResult`: lines[] `{ key: 'structure'|'finish'|'features'|'labor-info'|
'contingency', amount, meta? }` (labor is informational, included in materials+finish),
featureLines[] per enabled feature, total, rangeMin, rangeMax, costPerM2,
grossFloorAreaM2, finishLevel, rulesVersion, currency. All amounts rounded to 1000 UZS.
Requires land + house config; throws typed error otherwise (API maps to 409).

## Persistence & API

- Table `estimate_rules`: id cuid, version string, data JSONB (schema-validated on read;
  invalid stored data → 500 logged, never partial results), isActive boolean (unique
  partial index on isActive=true), createdAt. Seed inserts v1 active.
- `GET /api/v1/projects/:id/estimate?finishLevel=STANDARD|COMFORT|PREMIUM` (default
  STANDARD) — owner-scoped; 409 `PROJECT_NOT_CONFIGURED` when `isConfigurationComplete`
  is false; 200 `{ estimate: EstimateResult }`. Computed on demand, not persisted.
- Error codes: reuse `PROJECT_NOT_CONFIGURED`; add `ESTIMATE_RULES_MISSING` (500-class,
  logged — seed guarantees presence).

## Web (Smeta tab goes live)

Workspace tab `estimate`: finish-level segmented control (3 options with one-line
descriptions), summary header (total + range, cost/m², gross area), breakdown table
(structure, finish by level, features itemized, contingency; labor shown as an
informational note), UZS formatting with thousand separators (`Intl.NumberFormat('uz-UZ')`
style, no decimals), prominent disclaimer panel ("Dastlabki mo'ljal — qurilish hujjati
emas; narxlar mintaqa va materiallarga qarab o'zgaradi"), rules version footnote. States:
loading, PROJECT_NOT_CONFIGURED → edit CTA, error retry. Strings ×3 locales.

## Tests

- shared unit: fixture configs × rules → exact expected numbers (hand-computed), feature
  toggles, garden scaling, floor factor, rounding, range math, incomplete-config error.
- api e2e: unauth 401; foreign 404; unconfigured 409; configured project → 200 with
  correct total for seeded rules (assert exact number), finishLevel switch changes total,
  invalid finishLevel 400.
