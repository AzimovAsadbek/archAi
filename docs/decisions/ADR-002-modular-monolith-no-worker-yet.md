# ADR-002: Modular monolith; no worker/queue infrastructure yet

**Status:** accepted · 2026-08-14

Two deployables (web, api) + shared packages. No microservices, no Redis/BullMQ, no worker
process in the initial phases: slice 1–2 has no operation that outlives an HTTP request
budget. When AI/image/PDF generation lands, operations get explicit DB-backed states
(GENERATING → READY/FAILED, generation records with idempotency) executed in-process first;
a real queue is introduced only when measured need appears (long tasks, retries, fan-out).

Extraction candidates documented in docs/architecture.md. Revisit at slice 5.
