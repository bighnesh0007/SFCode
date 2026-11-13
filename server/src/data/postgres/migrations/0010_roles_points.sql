CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buddy_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"motivation" text NOT NULL,
	"link" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_applications_one_pending_idx" ON "buddy_applications" USING btree ("user_id") WHERE status = 'pending';--> statement-breakpoint
-- Seed the points table once. The cutover is fixed at migration time: solves before it keep their old coin value.
INSERT INTO "app_settings" ("key", "value") VALUES ('points', jsonb_build_object(
  'matrix', '{"lwc":{"Easy":4,"Medium":8,"Hard":12},"apex":{"Easy":3,"Medium":6,"Hard":9},"debug":{"Easy":2,"Medium":6,"Hard":9},"flow":{"Easy":2,"Medium":4,"Hard":6},"soql":{"Easy":1,"Medium":2,"Hard":3}}'::jsonb,
  'coinsPerPoint', 3,
  'cutover', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)) ON CONFLICT ("key") DO NOTHING;
