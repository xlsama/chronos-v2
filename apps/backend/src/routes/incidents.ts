import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import { AppError } from "../lib/errors";
import { getFinalSummaryMetadata, mergeFinalSummaryMetadata } from "../lib/final-summary";
import { publishChatEvent } from "../lib/redis";
import { runAgentInBackground } from "../lib/agent-runner";
import { incidentService } from "../services/incident.service";
import { messageService } from "../services/message.service";
import { logger } from "../lib/logger";
import { projectDocumentService } from "../services/project-document.service";
import { projectService } from "../services/project.service";

const incidentStatusSchema = z.enum([
  "new",
  "triaging",
  "in_progress",
  "waiting_human",
  "resolved",
  "summarizing",
  "completed",
]);

const attachmentSchema = z.object({
  type: z.enum(["image", "file"]),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
});

export const incidentRoutes = new Hono()
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        status: incidentStatusSchema.optional(),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query");
      const { items, total } = await incidentService.list(query);
      return c.json({ data: items, total });
    },
  )
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        content: z.string().min(1),
        projectId: z.string().uuid().nullable().optional(),
        attachments: z.array(attachmentSchema).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
    async (c) => {
      const input = c.req.valid("json");
      const incident = await incidentService.create({
        content: input.content,
        projectId: input.projectId ?? null,
        attachments: input.attachments ?? null,
        source: "manual",
        metadata: input.metadata ?? {},
        status: "triaging",
      });

      logger.info(
        { incidentId: incident.id, source: 'manual', projectId: incident.projectId },
        '[Incident] created manually'
      )

      const threadId = `incident-${incident.id}`;
      logger.info({ incidentId: incident.id, threadId }, '[Incident] triggering agent analysis')
      await messageService.save({
        threadId,
        incidentId: incident.id,
        role: "user",
        content: incident.content,
      });
      await publishChatEvent(threadId, "stream-start", { threadId });
      void runAgentInBackground(threadId, incident);

      return c.json({ data: incident }, 201);
    },
  )
  .get("/:id", async (c) => {
    const incident = await incidentService.getById(c.req.param("id"));
    if (!incident) throw new AppError(404, "Incident not found");

    const [project, relatedHistory] = await Promise.all([
      incident.projectId ? projectService.getById(incident.projectId) : Promise.resolve(null),
      incident.projectId
        ? projectDocumentService.search(incident.content, {
            kind: "incident_history",
            projectId: incident.projectId,
            limit: 3,
          })
        : Promise.resolve([]),
    ]);

    return c.json({
      data: {
        ...incident,
        project,
        relatedHistory,
      },
    });
  })
  .patch(
    "/:id",
    zValidator(
      "json",
      z.object({
        status: incidentStatusSchema.optional(),
        summary: z.string().nullable().optional(),
        finalSummaryDraft: z.string().nullable().optional(),
        resolutionNotes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const incident = await incidentService.update(c.req.param("id"), c.req.valid("json"));
      if (!incident) throw new AppError(404, "Incident not found");
      return c.json({ data: incident });
    },
  )
  .post("/:id/save-summary", async (c) => {
    const incident = await incidentService.getById(c.req.param("id"));
    if (!incident) throw new AppError(404, "Incident not found");
    if (!incident.projectId) throw new AppError(400, "Incident has no associated project");
    if (!incident.finalSummaryDraft) throw new AppError(400, "Incident has no summary draft");

    const summaryMeta = getFinalSummaryMetadata(incident.metadata);
    if (summaryMeta?.documentId) {
      const existingDocument = await projectDocumentService.getById(summaryMeta.documentId);
      if (existingDocument) {
        return c.json({ data: existingDocument });
      }
    }

    const document = await projectDocumentService.createMarkdownDocument({
      projectId: incident.projectId,
      kind: "incident_history",
      title: `${incident.summary ?? "incident"}-${incident.id.slice(0, 8)}`,
      content: incident.finalSummaryDraft,
      source: "agent",
      createdBy: "user",
      metadata: {
        incidentId: incident.id,
        incidentSummary: incident.summary,
        finalSummarySource: "summarize-agent",
      },
    });

    const now = new Date().toISOString();

    await incidentService.update(incident.id, {
      status: "completed",
      resolutionNotes: `Saved to incident history: ${document.title}`,
      metadata: mergeFinalSummaryMetadata(incident.metadata, {
        status: "saved",
        generatedAt: summaryMeta?.generatedAt ?? now,
        savedAt: now,
        documentId: document.id,
        source: "summarize-agent",
      }),
    });

    return c.json({ data: document }, 201);
  })
  .post(
    "/:id/archive-to-history",
    zValidator(
      "json",
      z.object({
        content: z.string().min(1),
        messageId: z.string().optional(),
      }),
    ),
    async (c) => {
      const incident = await incidentService.getById(c.req.param("id"));
      if (!incident) throw new AppError(404, "Incident not found");
      if (!incident.projectId)
        throw new AppError(400, "Incident has no associated project");

      const input = c.req.valid("json");
      const document = await projectDocumentService.createMarkdownDocument({
        projectId: incident.projectId,
        kind: "incident_history",
        title: `${incident.summary ?? "incident"}-${incident.id.slice(0, 8)}`,
        content: input.content,
        source: "agent",
        createdBy: "user",
        metadata: {
          incidentId: incident.id,
          incidentSummary: incident.summary,
          ...(input.messageId ? { sourceMessageId: input.messageId } : {}),
        },
      });

      return c.json({ data: document }, 201);
    },
  );
