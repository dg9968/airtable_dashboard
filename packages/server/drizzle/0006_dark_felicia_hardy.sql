CREATE TABLE "sales_tax_certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"st_certificate" text,
	"company_name" text,
	"business_partner" integer,
	"frequency" text,
	"corporation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_tax_certificates" ADD CONSTRAINT "sales_tax_certificates_corporation_id_corporations_id_fk" FOREIGN KEY ("corporation_id") REFERENCES "public"."corporations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_tax_certificates_corporation_idx" ON "sales_tax_certificates" USING btree ("corporation_id");