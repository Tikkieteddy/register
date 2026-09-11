CREATE TABLE "members" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"address" text,
	"photo_url" text,
	"ip_hash" varchar(64),
	"user_agent" text,
	"policy_version" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_uq" ON "members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "members_created_idx" ON "members" USING btree ("created_at");