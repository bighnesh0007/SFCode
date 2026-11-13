CREATE TABLE "problem_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_slug" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"spoiler" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "problem_comments_problem_idx" ON "problem_comments" USING btree ("problem_slug","created_at");--> statement-breakpoint
CREATE INDEX "problem_comments_created_idx" ON "problem_comments" USING btree ("created_at");