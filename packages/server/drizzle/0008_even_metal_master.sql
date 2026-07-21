CREATE TYPE "public"."billing_bundle_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."bundle_item_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TABLE "corporate_billing_bundle_items" (
	"id" text PRIMARY KEY NOT NULL,
	"bundle_id" text NOT NULL,
	"service_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "bundle_item_status" DEFAULT 'active' NOT NULL,
	"effective_date" text,
	"end_date" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_billing_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"corporation_id" text NOT NULL,
	"name" text,
	"status" "billing_bundle_status" DEFAULT 'active' NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"start_date" text,
	"end_date" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions_corporate" ADD COLUMN "bundle_item_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions_corporate" ADD COLUMN "billing_period" text;--> statement-breakpoint
ALTER TABLE "corporate_billing_bundle_items" ADD CONSTRAINT "corporate_billing_bundle_items_bundle_id_corporate_billing_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."corporate_billing_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_billing_bundle_items" ADD CONSTRAINT "corporate_billing_bundle_items_service_id_services_corporate_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services_corporate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_billing_bundles" ADD CONSTRAINT "corporate_billing_bundles_corporation_id_corporations_id_fk" FOREIGN KEY ("corporation_id") REFERENCES "public"."corporations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corporate_billing_bundle_items_bundle_idx" ON "corporate_billing_bundle_items" USING btree ("bundle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "corporate_billing_bundle_items_one_active_service_idx" ON "corporate_billing_bundle_items" USING btree ("bundle_id","service_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "corporate_billing_bundles_corporation_idx" ON "corporate_billing_bundles" USING btree ("corporation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "corporate_billing_bundles_one_active_idx" ON "corporate_billing_bundles" USING btree ("corporation_id") WHERE status = 'active';--> statement-breakpoint
ALTER TABLE "subscriptions_corporate" ADD CONSTRAINT "subscriptions_corporate_bundle_item_id_corporate_billing_bundle_items_id_fk" FOREIGN KEY ("bundle_item_id") REFERENCES "public"."corporate_billing_bundle_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_corporate_bundle_item_idx" ON "subscriptions_corporate" USING btree ("bundle_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_corporate_bundle_period_idx" ON "subscriptions_corporate" USING btree ("bundle_item_id","billing_period") WHERE bundle_item_id IS NOT NULL;