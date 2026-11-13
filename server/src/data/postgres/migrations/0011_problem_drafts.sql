CREATE TABLE "problem_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"slug" text NOT NULL,
	"content" jsonb NOT NULL,
	"check" jsonb,
	"review_note" text,
	"reviewed_by" text,
	"published_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"slug" text PRIMARY KEY NOT NULL,
	"ord" integer NOT NULL,
	"author_id" text NOT NULL,
	"approved_by" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problems_ord_unique" UNIQUE("ord")
);
--> statement-breakpoint
CREATE INDEX "problem_drafts_author_idx" ON "problem_drafts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "problem_drafts_status_idx" ON "problem_drafts" USING btree ("status");