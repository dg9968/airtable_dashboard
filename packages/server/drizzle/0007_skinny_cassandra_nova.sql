CREATE TABLE "staff_directory" (
	"user_id" text PRIMARY KEY NOT NULL,
	"extension" text,
	"cell_phone" text,
	"title" text,
	"direct_line" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_directory" ADD CONSTRAINT "staff_directory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;