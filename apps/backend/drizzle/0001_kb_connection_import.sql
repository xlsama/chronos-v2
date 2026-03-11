ALTER TABLE "connections"
  ADD COLUMN "kb_project_id" uuid;
--> statement-breakpoint
ALTER TABLE "connections"
  ADD COLUMN "import_source" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "connections"
  ADD COLUMN "import_metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "connections"
  ADD CONSTRAINT "connections_kb_project_id_kb_projects_id_fk"
  FOREIGN KEY ("kb_project_id")
  REFERENCES "public"."kb_projects"("id")
  ON DELETE set null
  ON UPDATE no action;
