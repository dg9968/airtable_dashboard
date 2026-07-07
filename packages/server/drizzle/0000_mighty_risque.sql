CREATE TABLE "message_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"template_code" text,
	"subject_template" text,
	"content_template" text,
	"description" text,
	"variable_definitions" text,
	"category" text,
	"status" text,
	"created_date" text,
	"last_used_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services_corporate" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2),
	"description" text,
	"category" text,
	"billing_cycle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"template_code" text,
	"dropbox_sign_template_id" text,
	"document_types" text[],
	"client_type" text,
	"number_of_signers" integer,
	"description" text,
	"status" text,
	"sort_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"summary" text,
	"content" text,
	"category_id" text,
	"tags" text[],
	"status" text,
	"author_name" text,
	"author_email" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_date" text,
	"last_modified" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"description" text,
	"icon" text,
	"color" text,
	"sort_order" integer,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_templates_status_idx" ON "message_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_articles_status_category_idx" ON "knowledge_articles" USING btree ("status","category_id");