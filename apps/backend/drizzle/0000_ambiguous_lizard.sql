CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."connection_type" AS ENUM('mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse', 'elasticsearch', 'kafka', 'rabbitmq', 'kubernetes', 'docker', 'argocd', 'grafana', 'prometheus', 'sentry', 'jenkins', 'datadog', 'pagerduty', 'opsgenie', 'apisix', 'kong', 'airflow', 'loki', 'ssh');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('knowledge', 'runbook', 'incident_history');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('upload', 'markdown', 'agent', 'job');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('markdown', 'pdf', 'xlsx', 'csv', 'docx');--> statement-breakpoint
CREATE TYPE "public"."incident_source" AS ENUM('manual', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."mcp_status" AS ENUM('idle', 'registering', 'registered', 'error');--> statement-breakpoint
CREATE TYPE "public"."processing_mode" AS ENUM('automatic', 'semi_automatic');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('active', 'draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('none', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"content" text NOT NULL,
	"summary" text,
	"attachments" jsonb,
	"source" "incident_source" DEFAULT 'manual' NOT NULL,
	"status" "incident_status" DEFAULT 'new' NOT NULL,
	"processing_mode" "processing_mode",
	"thread_id" text,
	"analysis" jsonb,
	"selected_skills" text[] DEFAULT '{}' NOT NULL,
	"final_summary_draft" text,
	"resolution_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"context_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"content" text,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"extension" text,
	"checksum" text,
	"source" "document_source" DEFAULT 'upload' NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"publication_status" "publication_status" DEFAULT 'active' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"embedding_model" text,
	"parser_error" text,
	"created_by" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "connection_type" NOT NULL,
	"description" text,
	"config" text NOT NULL,
	"status" "connection_status" DEFAULT 'disconnected' NOT NULL,
	"health_summary" text,
	"last_checked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_service_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_service_maps_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"project_id" uuid,
	"status" "agent_run_status" DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"selected_skills" text[] DEFAULT '{}' NOT NULL,
	"analysis" jsonb,
	"context" jsonb,
	"planned_actions" jsonb,
	"result" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"project_id" uuid,
	"skill_slug" text NOT NULL,
	"tool_key" text NOT NULL,
	"tool_name" text NOT NULL,
	"service_id" uuid,
	"service_name" text,
	"risk_level" "risk_level" NOT NULL,
	"approval_mode" "approval_mode" DEFAULT 'manual' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_services" ADD CONSTRAINT "project_services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_service_maps" ADD CONSTRAINT "project_service_maps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_service_id_project_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."project_services"("id") ON DELETE set null ON UPDATE no action;