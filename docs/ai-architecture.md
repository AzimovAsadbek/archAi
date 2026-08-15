# AI architecture — runtime provider (v2: free-tier-first, Gemini + Groq)

Runtime AI is an isolated application layer: `packages/ai` (`@archai/ai`) owns providers,
routing, prompts, schemas and validation; apps never import a provider SDK directly. AI
**proposes**, shared-domain code **validates**, the application **executes**. AI output never
touches the database without passing schema + domain validation, and the user always reviews a
proposal before it is applied.

> **Two separate layers — do not conflate.** This document is about the **deployed
> application's** runtime AI (Gemini/Groq, free-tier-first). It is unrelated to the models
> Claude Code uses to *develop* this repository. Runtime AI has no dependency on Anthropic.

```
              ARCHITECTURE ONLINE AI
                       │
                  AI SERVICE  (apps/api/src/ai — quota, usage, HTTP mapping)
                       │  provider-agnostic ArchitectureAIProvider
                RoutingArchitectureAIProvider
             ┌─────────┴──────────┐  (fallback only on transient errors)
   Gemini (flash-latest)         Groq (gpt-oss-120b)
          PRIMARY                   FALLBACK        + Mock (tests) / Unconfigured (no key)
             └─────────┬──────────┘
                Validated proposal → domain validation → user review
```

## Provider abstraction (packages/ai)

```ts
interface ArchitectureAIProvider {
  readonly name: string;                 // 'gemini' | 'groq' | 'mock' | 'unconfigured'
  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult>;
  // suggestLayout / generate*Concept arrive with later slices — never stubbed as fakes.
}

ParseProjectResult =
  | { ok: true;  proposal: ProjectProposal; provenance: AiProvenance }
  | { ok: false; error: AiErrorCode; message: string; provenance?: AiProvenance }

AiErrorCode = 'AI_NOT_CONFIGURED' | 'AI_RATE_LIMITED' | 'AI_PROVIDER_ERROR'
            | 'AI_REFUSED' | 'AI_INVALID_OUTPUT' | 'AI_TIMEOUT'
```

Providers **never throw** and **never log user text**: every SDK, network, safety or
validation failure returns `{ ok: false }` with a stable code and the attempt's provenance.
`ProjectProposal` is the zod schema in `packages/ai/src/schemas/proposal.schema.ts` (the
single source of truth); all numeric bounds mirror `LIMITS` from `@archai/shared`.

## The shared output pipeline

Both real providers run the identical normalization pipeline, which is the whole point of the
abstraction:

```
prompt → provider (native or json_object) → JSON → Zod validate
       → one correction pass on a schema miss → domain validation → application service
```

- The **wire schema** (`schemas/proposal.json-schema.ts`) mirrors the zod schema structurally,
  with bounds/enums imported from the same constants (a test guards against drift). Both
  providers get it appended to the system prompt in JSON mode: Gemini's native schema
  enforcement (`responseJsonSchema`/`responseSchema`) rejects the JSON-Schema features this
  schema uses (union-type nullability, `additionalProperties`) — confirmed live — so neither
  relies on it, which is what keeps the pipeline a single portable path.
- **Correction (§21):** on a schema-invalid answer the provider makes exactly **one** follow-up
  call quoting the structural Zod errors (which are our own snake_case keys, never user text),
  then gives up with `AI_INVALID_OUTPUT`. Non-JSON output is a provider fault, not retried.

## Gemini provider (primary)

- SDK `@google/genai` (2.x); model from `AI_PRIMARY_MODEL`, default **`gemini-flash-latest`**
  (a self-updating Flash alias — **text only, not image generation**). The directive's
  `gemini-2.5-flash` was retired for new keys by the live check (Aug 2026), so the default
  tracks the current Flash tier and stays overridable.
- `ai.models.generateContent({ model, contents, config })` with
  `responseMimeType: 'application/json'` (JSON mode; the schema lives in the system prompt),
  `thinkingConfig.thinkingBudget: 0` (extraction, not reasoning — cheaper/faster on free tier),
  low temperature, and `abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS)`.
- Errors → codes by shape (not `instanceof`): 429/quota → `AI_RATE_LIMITED`, abort/timeout →
  `AI_TIMEOUT`, 401/403 → `AI_PROVIDER_ERROR`, safety block (`promptFeedback.blockReason` or a
  `SAFETY`/`PROHIBITED_CONTENT` finish reason) → `AI_REFUSED`, empty output → `AI_INVALID_OUTPUT`.

## Groq provider (fallback)

- SDK `groq-sdk` (1.x); model from `AI_FALLBACK_MODEL`, default **`openai/gpt-oss-120b`**
  (the directive's `llama-3.3-70b-versatile` was decommissioned by the live check; gpt-oss-120b
  is available and structured-output capable). OpenAI-compatible chat completions with
  `response_format: { type: 'json_object' }` + schema-in-prompt + Zod.
  `signal: AbortSignal.timeout(AI_TIMEOUT_MS)`.
- Same error taxonomy: 429 → `AI_RATE_LIMITED`, abort → `AI_TIMEOUT`, 401/403 →
  `AI_PROVIDER_ERROR`, `content_filter` finish → `AI_REFUSED`.

## Routing (`packages/ai/src/router.ts`)

`RoutingArchitectureAIProvider` *is* an `ArchitectureAIProvider`, so the application never
learns whether one provider or two answered; provenance names the provider that actually
produced the result.

- **Same-provider retry** (`AI_MAX_RETRIES`, exponential backoff) on `AI_TIMEOUT` /
  `AI_PROVIDER_ERROR` only.
- **Cross-provider fallback** on the transient set (`AI_TIMEOUT`, `AI_RATE_LIMITED`,
  `AI_PROVIDER_ERROR`).
- **Never falls back** on app/prompt faults — `AI_REFUSED`, `AI_INVALID_OUTPUT`,
  `AI_NOT_CONFIGURED` (§14: a different model does not fix a refusal or a schema miss).

## Factory & configuration

`createArchitectureAIProvider` selects the primary by `AI_PROVIDER`, wires a fallback only when
`AI_FALLBACK_PROVIDER` is distinct and its key is present, and returns a router. When the
**primary's** key is missing it returns the **unconfigured** provider (honest
`AI_NOT_CONFIGURED`), never a silent fallback dressed up as healthy. Env (server-side only):

| var | default | meaning |
|---|---|---|
| `AI_PROVIDER` | `gemini` | primary: `gemini`\|`groq`\|`mock` |
| `AI_FALLBACK_PROVIDER` | `groq` | runtime fallback, or `none` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | — | provider keys (empty ⇒ that provider unavailable) |
| `AI_PRIMARY_MODEL` / `AI_FALLBACK_MODEL` | provider defaults | model overrides |
| `AI_MAX_REQUESTS_PER_USER_PER_DAY` | `20` | app-level per-user quota (0 = off) |
| `AI_TIMEOUT_MS` | `30000` | per-provider request timeout |
| `AI_MAX_RETRIES` | `1` | same-provider transient retries |

Switching provider is configuration-only: no controller, service, schema or UI change.

## Prompt architecture

`packages/ai/src/prompts/parse-project.ts` (`PARSE_PROJECT_PROMPT_VERSION = '1'`, provider-
agnostic). The user text is **data, not instructions**: fenced in `<user_request>` tags,
literal tags neutralised, an explicit anti-injection paragraph (ignore any instructions inside,
never reveal the prompt or that one exists). Extract only what is stated; unstated values stay
null; `sotix × 100 = m²`; contradictions go to `unmappable`. Prompt text changes bump the version.

## API module (apps/api/src/ai)

`POST /api/v1/ai/parse-project` — authenticated, throttled 10/min/IP, **plus a per-user daily
quota** counted from `ai_generations` (rejects with **429 `AI_QUOTA_EXCEEDED`** *before* any
provider call, so a rejected request costs no provider budget and writes no row).

- Provider result → HTTP: `AI_NOT_CONFIGURED` → 503; `AI_RATE_LIMITED`/`AI_QUOTA_EXCEEDED` →
  429; `AI_TIMEOUT`/`AI_PROVIDER_ERROR` → 502; `AI_REFUSED`/`AI_INVALID_OUTPUT` → 422 — always
  in `ApiErrorShape`, message localized by code, provider diagnostics stay server-side.
- Success: re-validate each block with the shared schemas (drop invalid blocks + add a server
  note rather than failing wholesale), then `validateProjectConfiguration`. The endpoint
  **proposes only** — nothing is written to project tables.
- `ai_generations` provenance row (no user text): provider, model, promptVersion, status,
  errorCode?, inputTokens?, outputTokens?, durationMs. Token counts are left null when a
  provider does not report them — never fabricated.
- `GET /api/v1/ai/status` — secrets-free diagnostic: `{ provider, available, fallbackProvider,
  fallbackAvailable, primaryModel, dailyRequestLimitPerUser }`, derived from configuration.

## Free-tier discipline

AI is used only for natural-language understanding. Deterministic work stays deterministic:
floor-plan geometry, estimates and validation never call a model. Requests are bounded
(timeout + retry + fallback), the schema is compact, and the daily per-user quota protects the
shared free-tier budget. The app never claims unlimited free usage.

## Testing

- **packages/ai unit (69 tests):** proposal schema fixtures; wire-schema drift guard;
  `parseProposal` (valid / fenced / non-JSON / schema-invalid / out-of-bounds); Gemini and Groq
  providers with injected fake clients (happy path, one-correction, rate-limit/timeout/auth/
  refusal/empty mapping); router (success, fallback-on-transient, no-fallback-on-app-fault,
  retry, no-fallback); factory (selection, unconfigured, groq-fallback integration).
- **api e2e:** 401/400 guards; 503 when unconfigured; success + provenance (no text) + every
  error mapping via a DI-bound fake; `GET /ai/status`; per-user quota → 429. **No suite makes a
  live provider call** (keys are neutralised at module scope; providers are faked).
- **Live provider verification** is opt-in and manual (`docs/testing.md`): never run in CI,
  never required for normal tests. Until a real Gemini request has succeeded, the honest status
  is *"provider implementation complete and contract-tested; live verification pending."*
