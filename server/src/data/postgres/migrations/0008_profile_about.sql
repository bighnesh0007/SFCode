CREATE TABLE "user_about" (
	"user_id" text PRIMARY KEY NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"trailhead_url" text,
	"linkedin_url" text,
	"github_url" text,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_to_work" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
