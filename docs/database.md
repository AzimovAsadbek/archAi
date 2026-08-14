# Database

PostgreSQL 16 (Docker locally: `pnpm db:up`; databases `archai` + `archai_test`;
host port **5433** — this machine runs a native PostgreSQL on 5432).
Prisma schema at `apps/api/prisma/schema.prisma` is the source of truth; migrate with
`pnpm db:migrate`, seed with `pnpm db:seed`.

## Tables (slice 1)

- `users` — unique email, argon2id `passwordHash`, role, isActive, timestamps.
- `refresh_tokens` — sha256 `tokenHash` (unique), expiresAt, revokedAt, userAgent,
  FK user (cascade). Rotation writes a new row and revokes the old; reuse of a revoked
  token revokes all of the user's tokens.
- `projects` — FK owner (cascade), name/description, status enum, flat config columns
  (land*/house*/floorCount/style/has*), timestamps, `deletedAt` for soft delete.
  Indexes: `(ownerId, status)`, `(ownerId, updatedAt)`.
- `rooms` — FK project (cascade), type enum, floor int, dims, label, sortOrder.

## Design rules

- Flat columns over JSONB while the configuration shape is stable and queryable;
  JSONB reserved for genuinely flexible payloads (future AI provenance/metadata).
- Soft delete only for user-facing aggregates (projects). Related rows (rooms) cascade
  on hard delete; soft-deleted projects keep rooms for restore.
- Every user-owned table carries an explicit owner FK — queries must filter by it.
- No destructive cascade from config updates: rooms are replaced transactionally.
