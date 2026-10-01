# Admin financial summary counts only existing stores

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

After stores were deleted, the Admin Dashboard "Financial Summary (All Stores)" still showed their sales, expenses and transaction counts, while the new stores had no data. `deleteStore` only removes the store and its manager assignments. Its transactions and expenses stay in the database. `GET /api/reports/summary` without `storeId` summed every paid transaction and expense, so the orphaned records were included.

## Decision

When `storeId` is not given, `getSummary` first loads the IDs of stores that currently exist and filters both transactions and expenses to `storeId: { $in: ids }`. A request with a `storeId` is unchanged. The system-wide totals now equal the sum of the per-store cards.

## Alternatives Considered

- Cascade-deleting transactions, expenses and other store data inside `deleteStore`. Rejected for now: destructive, and it would not clean up records already orphaned.
- Filtering in `dashboard.astro` by summing the per-store summaries. Rejected because other API consumers of the system-wide summary would stay wrong.

## Consequences

- Orphaned records from deleted stores remain in the database but no longer affect the summary.
- One extra lightweight query per system-wide summary request.
- Follow-up: decide whether `deleteStore` should cascade-delete store-owned data.
