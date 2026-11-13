CREATE TABLE "cert_question_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"content" jsonb NOT NULL,
	"review_note" text,
	"reviewed_by" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cert_question_drafts_author_idx" ON "cert_question_drafts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "cert_question_drafts_status_idx" ON "cert_question_drafts" USING btree ("status");