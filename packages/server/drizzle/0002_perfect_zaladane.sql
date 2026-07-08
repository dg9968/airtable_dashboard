CREATE TABLE "billing_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"services_rendered_id" text,
	"author_name" text,
	"author_email" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_pipeline_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_corporate_id" text,
	"author_name" text,
	"author_email" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"service_rendered" text,
	"receipt_date" text,
	"amount_charged" numeric(10, 2),
	"name_of_client" text,
	"payment_method" text,
	"subscription_personal_id" text,
	"subscription_corporate_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_personal_id" text,
	"author_name" text,
	"author_email" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services_rendered" (
	"id" text PRIMARY KEY NOT NULL,
	"client_name" text,
	"client_type" text,
	"billing_status" text,
	"service_type" text,
	"service_rendered_date" text,
	"processor" text,
	"amount_charged" numeric(10, 2),
	"payment_method" text,
	"receipt_date" text,
	"notes" text,
	"subscription_personal_id" text,
	"subscription_corporate_id" text,
	"ledger_entry_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions_corporate" (
	"id" text PRIMARY KEY NOT NULL,
	"corporation_id" text,
	"service_id" text,
	"status" text,
	"notes" text,
	"processor_id" text,
	"tax_preparer" text,
	"date_assigned" text,
	"billing_amount" numeric(10, 2),
	"filed" boolean,
	"send_to_bookkeeper" boolean,
	"duration" integer,
	"bookkeeper_estimate" text,
	"due_date" text,
	"quarterly_st_date" text,
	"monthly_st_date" text,
	"extension_tax_year" integer,
	"extension_status" text,
	"extension_filed_date" text,
	"extension_estimated_tax" numeric,
	"extension_payments_credits" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions_personal" (
	"id" text PRIMARY KEY NOT NULL,
	"personal_id" text,
	"service_id" text,
	"status" text,
	"notes" text,
	"tax_preparer_id" text,
	"extension_tax_year" integer,
	"extension_status" text,
	"extension_filed_date" text,
	"extension_estimated_tax" numeric,
	"extension_payments_credits" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_notes" ADD CONSTRAINT "billing_notes_services_rendered_id_services_rendered_id_fk" FOREIGN KEY ("services_rendered_id") REFERENCES "public"."services_rendered"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_pipeline_notes" ADD CONSTRAINT "corporate_pipeline_notes_subscription_corporate_id_subscriptions_corporate_id_fk" FOREIGN KEY ("subscription_corporate_id") REFERENCES "public"."subscriptions_corporate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_notes" ADD CONSTRAINT "pipeline_notes_subscription_personal_id_subscriptions_personal_id_fk" FOREIGN KEY ("subscription_personal_id") REFERENCES "public"."subscriptions_personal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions_corporate" ADD CONSTRAINT "subscriptions_corporate_corporation_id_corporations_id_fk" FOREIGN KEY ("corporation_id") REFERENCES "public"."corporations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions_corporate" ADD CONSTRAINT "subscriptions_corporate_service_id_services_corporate_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services_corporate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions_personal" ADD CONSTRAINT "subscriptions_personal_personal_id_personal_id_fk" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions_personal" ADD CONSTRAINT "subscriptions_personal_service_id_personal_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."personal_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_notes_services_rendered_idx" ON "billing_notes" USING btree ("services_rendered_id");--> statement-breakpoint
CREATE INDEX "corporate_pipeline_notes_subscription_idx" ON "corporate_pipeline_notes" USING btree ("subscription_corporate_id");--> statement-breakpoint
CREATE INDEX "ledger_receipt_date_idx" ON "ledger" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "pipeline_notes_subscription_idx" ON "pipeline_notes" USING btree ("subscription_personal_id");--> statement-breakpoint
CREATE INDEX "services_rendered_billing_status_idx" ON "services_rendered" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "services_rendered_date_idx" ON "services_rendered" USING btree ("service_rendered_date");--> statement-breakpoint
CREATE INDEX "subscriptions_corporate_corporation_idx" ON "subscriptions_corporate" USING btree ("corporation_id");--> statement-breakpoint
CREATE INDEX "subscriptions_corporate_service_idx" ON "subscriptions_corporate" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "subscriptions_corporate_status_idx" ON "subscriptions_corporate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_personal_personal_idx" ON "subscriptions_personal" USING btree ("personal_id");--> statement-breakpoint
CREATE INDEX "subscriptions_personal_service_idx" ON "subscriptions_personal" USING btree ("service_id");