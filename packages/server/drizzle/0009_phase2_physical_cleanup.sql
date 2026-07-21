-- Phase 2 physical cleanup: rename tables/indexes/constraints to match
-- their TypeScript names, drop deprecated columns, and drop the fully-
-- superseded ledger table. See
-- packages/server/src/db/schema/subscriptions.ts for the rationale.
-- RENAME CONSTRAINT ... FROM names are the actual (already 63-byte-
-- truncated) names live in Postgres today; the TO names are the full
-- untruncated names Drizzle computes from schema.ts -- Postgres will
-- silently re-truncate them again on execution, exactly as it did
-- originally, keeping this migration's result consistent with a fresh
-- drizzle-kit-generated snapshot.

-- 1. Rename tables
ALTER TABLE "subscriptions_personal" RENAME TO "personal_pipeline_tickets";
ALTER TABLE "subscriptions_corporate" RENAME TO "corporate_pipeline_tickets";
ALTER TABLE "services_rendered" RENAME TO "billing_records";

-- 2. Rename indexes to match
ALTER INDEX "subscriptions_personal_personal_idx" RENAME TO "personal_pipeline_tickets_personal_idx";
ALTER INDEX "subscriptions_personal_service_idx" RENAME TO "personal_pipeline_tickets_service_idx";
ALTER INDEX "subscriptions_corporate_corporation_idx" RENAME TO "corporate_pipeline_tickets_corporation_idx";
ALTER INDEX "subscriptions_corporate_service_idx" RENAME TO "corporate_pipeline_tickets_service_idx";
ALTER INDEX "subscriptions_corporate_status_idx" RENAME TO "corporate_pipeline_tickets_status_idx";
ALTER INDEX "subscriptions_corporate_bundle_item_idx" RENAME TO "corporate_pipeline_tickets_bundle_item_idx";
ALTER INDEX "subscriptions_corporate_bundle_period_idx" RENAME TO "corporate_pipeline_tickets_bundle_period_idx";
ALTER INDEX "services_rendered_billing_status_idx" RENAME TO "billing_records_billing_status_idx";
ALTER INDEX "services_rendered_date_idx" RENAME TO "billing_records_date_idx";

-- 3. Rename FK constraints to match
ALTER TABLE "personal_pipeline_tickets" RENAME CONSTRAINT "subscriptions_personal_personal_id_personal_id_fk" TO "personal_pipeline_tickets_personal_id_personal_id_fk";
ALTER TABLE "personal_pipeline_tickets" RENAME CONSTRAINT "subscriptions_personal_service_id_personal_services_id_fk" TO "personal_pipeline_tickets_service_id_personal_services_id_fk";
ALTER TABLE "corporate_pipeline_tickets" RENAME CONSTRAINT "subscriptions_corporate_corporation_id_corporations_id_fk" TO "corporate_pipeline_tickets_corporation_id_corporations_id_fk";
ALTER TABLE "corporate_pipeline_tickets" RENAME CONSTRAINT "subscriptions_corporate_service_id_services_corporate_id_fk" TO "corporate_pipeline_tickets_service_id_services_corporate_id_fk";
ALTER TABLE "corporate_pipeline_tickets" RENAME CONSTRAINT "subscriptions_corporate_bundle_item_id_corporate_billing_bundle" TO "corporate_pipeline_tickets_bundle_item_id_corporate_billing_bundle_items_id_fk";
ALTER TABLE "pipeline_notes" RENAME CONSTRAINT "pipeline_notes_subscription_personal_id_subscriptions_personal_" TO "pipeline_notes_subscription_personal_id_personal_pipeline_tickets_id_fk";
ALTER TABLE "corporate_pipeline_notes" RENAME CONSTRAINT "corporate_pipeline_notes_subscription_corporate_id_subscription" TO "corporate_pipeline_notes_subscription_corporate_id_corporate_pipeline_tickets_id_fk";
ALTER TABLE "billing_notes" RENAME CONSTRAINT "billing_notes_services_rendered_id_services_rendered_id_fk" TO "billing_notes_services_rendered_id_billing_records_id_fk";

-- 4. Drop deprecated columns (no app code reads/writes them)
ALTER TABLE "corporate_pipeline_tickets" DROP COLUMN "billing_amount";
ALTER TABLE "billing_records" DROP COLUMN "ledger_entry_id";

-- 5. Drop the now-fully-superseded ledger table (all data carried into billing_records)
DROP TABLE "ledger";
