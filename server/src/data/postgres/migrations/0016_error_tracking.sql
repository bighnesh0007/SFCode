CREATE TABLE "error_events" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"path" text,
	"user_agent" text,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"users" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"day" text NOT NULL,
	"path" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "page_views_day_path_pk" PRIMARY KEY("day","path")
);
--> statement-breakpoint
CREATE INDEX "error_events_last_seen_idx" ON "error_events" USING btree ("last_seen");