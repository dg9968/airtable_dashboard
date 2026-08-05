ALTER TABLE "personal_services" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "personal_services" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "personal_services" ADD COLUMN "status" text DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE "services_corporate" ADD COLUMN "vendor_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "services_corporate" ADD COLUMN "vendor_name" text;--> statement-breakpoint
ALTER TABLE "services_corporate" ADD COLUMN "status" text DEFAULT 'Active' NOT NULL;