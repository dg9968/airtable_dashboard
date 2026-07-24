ALTER TABLE "corporate_pipeline_tickets" ADD COLUMN "certificate_id" text;--> statement-breakpoint
ALTER TABLE "sales_tax_certificates" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "sales_tax_certificates" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "sales_tax_certificates" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "sales_tax_certificates" ADD COLUMN "zip" text;--> statement-breakpoint
ALTER TABLE "corporate_pipeline_tickets" ADD CONSTRAINT "corporate_pipeline_tickets_certificate_id_sales_tax_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."sales_tax_certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corporate_pipeline_tickets_certificate_idx" ON "corporate_pipeline_tickets" USING btree ("certificate_id");