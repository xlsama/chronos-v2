import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { projectDocuments, projects } from "../db/schema";
import { GLOBAL_PROJECT_SLUG } from "./project.service";
import { deleteVectorsIfIndexExists, pgVector } from "../db/vector-store";
import { env } from "../env";
import { chunkMarkdown, chunkTabularText, chunkText } from "../lib/chunker";
import { embedText, embedTexts } from "../lib/embedder";
import { extractText } from "../lib/extractors";
import {
  deleteStoredFile,
  readStoredText,
  resolveStoredPath,
  slugifySegment,
  toPublicFileUrl,
  writeMarkdownProjectFile,
  writeUploadedProjectFile,
} from "../lib/file-storage";
import { logger } from "../lib/logger";
import { rerank } from "../lib/reranker";

type DocumentKind = "knowledge" | "runbook" | "incident_history";
type SourceKind = "upload" | "markdown" | "agent" | "job";
type PublicationStatus = "active" | "draft" | "published" | "archived";
type DocumentStatus = "pending" | "processing" | "ready" | "error" | "cancelling" | "cancelled";
type DocumentIndexingStatus = "indexed" | "not_indexed";
type DocumentIndexingReason =
  | "empty_content"
  | "empty_chunks"
  | "image_without_ocr"
  | "index_write_skipped";

interface DocumentIndexingState {
  indexingStatus: DocumentIndexingStatus;
  indexingReason: DocumentIndexingReason | null;
  indexedAt: string | null;
  vectorCount: number;
}

class DocumentProcessAbortedError extends Error {
  constructor() {
    super("Document processing aborted");
    this.name = "DocumentProcessAbortedError";
  }
}

const activeDocumentProcesses = new Map<
  string,
  { controller: AbortController; promise: Promise<unknown>; runId: symbol }
>();

export interface SearchDocumentResult {
  documentId: string;
  projectId: string;
  projectName: string;
  title: string;
  content: string;
  filePath: string;
  kind: DocumentKind;
  similarity: number;
  rerankScore?: number;
  publicationStatus: PublicationStatus;
}

function castDocumentKind(kind: string): DocumentKind {
  return kind as DocumentKind;
}

function isDocumentIndexingStatus(value: unknown): value is DocumentIndexingStatus {
  return value === "indexed" || value === "not_indexed";
}

function isDocumentIndexingReason(value: unknown): value is DocumentIndexingReason {
  return (
    value === "empty_content" ||
    value === "empty_chunks" ||
    value === "image_without_ocr" ||
    value === "index_write_skipped"
  );
}

function isCancellationStatus(status: DocumentStatus) {
  return status === "cancelling" || status === "cancelled";
}

function isImageExtension(extension: string | null) {
  return (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "gif" ||
    extension === "webp"
  );
}

function throwIfDocumentProcessAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DocumentProcessAbortedError();
  }
}

function runTrackedDocumentProcess<T>(
  documentId: string,
  work: (signal: AbortSignal) => Promise<T>,
) {
  activeDocumentProcesses.get(documentId)?.controller.abort();

  const controller = new AbortController();
  const runId = Symbol(documentId);
  const promise = work(controller.signal).finally(() => {
    const active = activeDocumentProcesses.get(documentId);
    if (active?.runId === runId) {
      activeDocumentProcesses.delete(documentId);
    }
  });

  activeDocumentProcesses.set(documentId, { controller, promise, runId });
  return promise;
}

async function abortAndWaitForDocumentProcess(documentId: string) {
  const active = activeDocumentProcesses.get(documentId);
  if (!active) return;

  active.controller.abort();
  try {
    await active.promise;
  } catch {
    // Process errors are handled inside reprocess; deletion only needs to wait for it to settle.
  }
}

export const projectDocumentService = {
  async list(
    projectId: string,
    options: { kind?: DocumentKind; publicationStatus?: PublicationStatus } = {},
  ) {
    const conditions = [eq(projectDocuments.projectId, projectId)];
    if (options.kind) conditions.push(eq(projectDocuments.kind, options.kind));
    if (options.publicationStatus)
      conditions.push(eq(projectDocuments.publicationStatus, options.publicationStatus));

    const rows = await db
      .select()
      .from(projectDocuments)
      .where(and(...conditions))
      .orderBy(desc(projectDocuments.createdAt));
    return rows.map(withPublicUrl);
  },

  async listPaginated(
    projectId: string,
    options: {
      kind?: DocumentKind;
      publicationStatus?: PublicationStatus;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const conditions = [eq(projectDocuments.projectId, projectId)];
    if (options.kind) conditions.push(eq(projectDocuments.kind, options.kind));
    if (options.publicationStatus)
      conditions.push(eq(projectDocuments.publicationStatus, options.publicationStatus));

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 10;
    const offset = (page - 1) * pageSize;
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(projectDocuments)
        .where(where)
        .orderBy(desc(projectDocuments.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(projectDocuments).where(where),
    ]);

    return {
      items: rows.map(withPublicUrl),
      total,
      page,
      pageSize,
    };
  },

  async listAcrossProjects(options: { kind: DocumentKind; publicationStatus?: PublicationStatus }) {
    const conditions = [eq(projectDocuments.kind, options.kind)];
    if (options.publicationStatus)
      conditions.push(eq(projectDocuments.publicationStatus, options.publicationStatus));
    const rows = await db
      .select()
      .from(projectDocuments)
      .where(and(...conditions))
      .orderBy(desc(projectDocuments.createdAt));
    return rows.map(withPublicUrl);
  },

  async getById(id: string) {
    const [row] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, id));
    return row ? withPublicUrl(row) : null;
  },

  async createMarkdownDocument(input: {
    projectId: string;
    kind: DocumentKind;
    title: string;
    content: string;
    tags?: string[];
    description?: string;
    publicationStatus?: PublicationStatus;
    source?: SourceKind;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }) {
    const project = await getProjectOrThrow(input.projectId);
    const stored = await writeMarkdownProjectFile({
      projectSlug: project.slug,
      kind: input.kind,
      title: input.title,
      content: input.content,
    });

    const [row] = await db
      .insert(projectDocuments)
      .values({
        projectId: input.projectId,
        kind: input.kind,
        title: input.title,
        slug: slugifySegment(input.title),
        description: input.description,
        tags: input.tags ?? [],
        content: input.content,
        filePath: stored.relativePath,
        fileName: stored.fileName,
        mimeType: "text/markdown",
        extension: stored.extension,
        checksum: stored.checksum,
        source: input.source ?? "markdown",
        publicationStatus: input.publicationStatus ?? defaultPublicationStatus(input.kind),
        createdBy: input.createdBy,
        metadata: input.metadata ?? {},
      })
      .returning();

    void this.reprocess(row.id);
    return withPublicUrl(row);
  },

  async createUploadedDocument(input: {
    projectId: string;
    kind: DocumentKind;
    title: string;
    file: File;
    tags?: string[];
    description?: string;
    publicationStatus?: PublicationStatus;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }) {
    const project = await getProjectOrThrow(input.projectId);
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const stored = await writeUploadedProjectFile({
      projectSlug: project.slug,
      kind: input.kind,
      title: input.title,
      originalName: input.file.name,
      buffer,
    });

    const [row] = await db
      .insert(projectDocuments)
      .values({
        projectId: input.projectId,
        kind: input.kind,
        title: input.title,
        slug: slugifySegment(input.title),
        description: input.description,
        tags: input.tags ?? [],
        filePath: stored.relativePath,
        fileName: stored.fileName,
        mimeType: input.file.type || "application/octet-stream",
        extension: stored.extension,
        checksum: stored.checksum,
        source: "upload",
        publicationStatus: input.publicationStatus ?? defaultPublicationStatus(input.kind),
        createdBy: input.createdBy,
        metadata: input.metadata ?? {},
      })
      .returning();

    void this.reprocess(row.id);
    return withPublicUrl(row);
  },

  async updateDocument(
    id: string,
    input: {
      title?: string;
      content?: string;
      description?: string;
      tags?: string[];
      publicationStatus?: PublicationStatus;
      metadata?: Record<string, unknown>;
    },
  ) {
    const existing = await this.getById(id);
    if (!existing) return null;

    let content = existing.content ?? null;
    let checksum = existing.checksum;
    let filePath = existing.filePath;
    let fileName = existing.fileName;
    let extension = existing.extension;
    if (typeof input.content === "string" && existing.extension === "md") {
      await db
        .update(projectDocuments)
        .set({
          status: "pending",
          chunkCount: 0,
          embeddingModel: null,
          parserError: null,
          metadata: withIndexingMetadata(existing.metadata, {
            indexingStatus: "not_indexed",
            indexingReason: null,
            indexedAt: null,
            vectorCount: 0,
          }),
        })
        .where(eq(projectDocuments.id, id));
      const stored = await writeMarkdownProjectFile({
        projectSlug: await getProjectSlug(existing.projectId),
        kind: castDocumentKind(existing.kind),
        title: input.title ?? existing.title,
        content: input.content,
      });
      content = input.content;
      checksum = stored.checksum;
      filePath = stored.relativePath;
      fileName = stored.fileName;
      extension = stored.extension;
    }

    const [row] = await db
      .update(projectDocuments)
      .set({
        ...input,
        ...(input.title ? { slug: slugifySegment(input.title) } : {}),
        ...(content !== null ? { content } : {}),
        ...(checksum ? { checksum } : {}),
        ...(filePath ? { filePath } : {}),
        ...(fileName ? { fileName } : {}),
        ...(extension ? { extension } : {}),
        ...(input.metadata
          ? { metadata: { ...(existing.metadata ?? {}), ...input.metadata } }
          : {}),
      })
      .where(eq(projectDocuments.id, id))
      .returning();

    if (typeof input.content === "string") {
      void this.reprocess(id);
    }

    return row ? withPublicUrl(row) : null;
  },

  async deleteDocument(id: string) {
    const existing = await this.getById(id);
    if (!existing) return null;

    await db
      .update(projectDocuments)
      .set({
        status: "cancelling",
        metadata: {
          ...(existing.metadata ?? {}),
          deletionRequestedAt: new Date().toISOString(),
        },
      })
      .where(eq(projectDocuments.id, id));

    await abortAndWaitForDocumentProcess(id);
    await db
      .update(projectDocuments)
      .set({ status: "cancelled" })
      .where(eq(projectDocuments.id, id));
    const latest = await this.getById(id);
    if (!latest) return null;

    await deleteVectorsIfIndexExists({
      indexName: "document_embeddings",
      filter: { documentId: id },
    });
    await deleteStoredFile(latest.filePath);
    const [row] = await db.delete(projectDocuments).where(eq(projectDocuments.id, id)).returning();
    return row ? withPublicUrl(row) : null;
  },

  async reprocess(documentId: string) {
    return runTrackedDocumentProcess(documentId, async (signal) => {
      try {
        const document = await markDocumentProcessing(documentId);
        if (!document) return null;

        throwIfDocumentProcessAborted(signal);
        const text = await extractDocumentText(
          document.filePath,
          document.extension,
          document.content,
        );
        throwIfDocumentProcessAborted(signal);

        const chunks = await createChunks(document.extension, text);
        throwIfDocumentProcessAborted(signal);

        const embeddings =
          chunks.length > 0
            ? await embedTexts(
                chunks.map((chunk) => chunk.content),
                { signal },
              )
            : [];
        throwIfDocumentProcessAborted(signal);

        const latestDocument = await getActiveDocument(documentId);
        if (!latestDocument) return null;

        await pgVector.deleteVectors({ indexName: "document_embeddings", filter: { documentId } });
        throwIfDocumentProcessAborted(signal);

        const indexingState =
          chunks.length > 0
            ? buildIndexedState(chunks.length)
            : buildNotIndexedState({
                extension: latestDocument.extension,
                text,
                chunkCount: chunks.length,
              });

        if (chunks.length > 0) {
          await pgVector.upsert({
            indexName: "document_embeddings",
            vectors: embeddings,
            metadata: chunks.map((chunk) => ({
              text: chunk.content,
              documentId,
              projectId: latestDocument.projectId,
              kind: latestDocument.kind,
              title: latestDocument.title,
              filePath: latestDocument.filePath,
              publicationStatus: latestDocument.publicationStatus,
              chunkIndex: chunk.index,
            })),
            ids: chunks.map((chunk) => `${documentId}_${chunk.index}`),
          });
        }

        throwIfDocumentProcessAborted(signal);

        const [row] = await db
          .update(projectDocuments)
          .set({
            content: text,
            chunkCount: chunks.length,
            embeddingModel: chunks.length > 0 ? env.EMBEDDING_MODEL : null,
            metadata: withIndexingMetadata(latestDocument.metadata, indexingState),
            status: "ready",
          })
          .where(
            and(eq(projectDocuments.id, documentId), eq(projectDocuments.status, "processing")),
          )
          .returning();

        return row ? withPublicUrl(row) : null;
      } catch (error) {
        if (
          error instanceof DocumentProcessAbortedError ||
          (error instanceof Error && error.name === "DocumentProcessAbortedError")
        ) {
          return null;
        }

        const current = await getDocumentState(documentId);
        if (!current || isCancellationStatus(current.status)) {
          return null;
        }

        const message = error instanceof Error ? error.message : "Unknown parser error";
        logger.error({ err: error, documentId }, "Failed to process project document");
        const currentDocument = await getActiveDocument(documentId);
        await db
          .update(projectDocuments)
          .set({
            status: "error",
            parserError: message,
            embeddingModel: null,
            metadata: withIndexingMetadata(
              currentDocument?.metadata,
              buildNotIndexedState({
                extension: currentDocument?.extension ?? null,
                text: currentDocument?.content ?? "",
                chunkCount: 0,
                reason: "index_write_skipped",
              }),
            ),
          })
          .where(eq(projectDocuments.id, documentId));
        return null;
      }
    });
  },

  async search(
    query: string,
    options: {
      kind: DocumentKind;
      projectId?: string;
      publicationStatuses?: PublicationStatus[];
      limit?: number;
      includeGlobal?: boolean;
    },
  ): Promise<SearchDocumentResult[]> {
    const embedding = await embedText(query);
    const filter: Record<string, unknown> = { kind: options.kind };

    // Include global project in search when searching a specific project
    if (options.projectId && (options.includeGlobal ?? true)) {
      const [globalProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.slug, GLOBAL_PROJECT_SLUG));
      if (globalProject && globalProject.id !== options.projectId) {
        filter.projectId = { $in: [options.projectId, globalProject.id] };
      } else {
        filter.projectId = options.projectId;
      }
    } else if (options.projectId) {
      filter.projectId = options.projectId;
    }

    if (options.publicationStatuses?.length)
      filter.publicationStatus = { $in: options.publicationStatuses };

    const vectorResults = await pgVector.query({
      indexName: "document_embeddings",
      queryVector: embedding,
      topK: (options.limit ?? 5) * 3,
      includeVector: false,
      filter: filter as any,
    });

    if (vectorResults.length === 0) return [];

    const reranked = await rerank(
      query,
      vectorResults.map((result) => String(result.metadata?.text ?? "")),
      {
        topN: options.limit ?? 5,
      },
    );

    const documentIds = [
      ...new Set(
        reranked.map((item) => String(vectorResults[item.index].metadata?.documentId ?? "")),
      ),
    ];
    const documents =
      documentIds.length > 0
        ? await db
            .select()
            .from(projectDocuments)
            .where(
              and(
                inArray(projectDocuments.id, documentIds),
                or(
                  eq(projectDocuments.status, "pending"),
                  eq(projectDocuments.status, "processing"),
                  eq(projectDocuments.status, "ready"),
                  eq(projectDocuments.status, "error"),
                ),
              ),
            )
        : [];

    const projectIds = [...new Set(documents.map((document) => document.projectId))];
    const projectRows =
      projectIds.length > 0
        ? await db.select().from(projects).where(inArray(projects.id, projectIds))
        : [];

    const documentMap = new Map(documents.map((document) => [document.id, document]));
    const projectMap = new Map(projectRows.map((project) => [project.id, project]));

    return reranked.flatMap((item) => {
      const original = vectorResults[item.index];
      const documentId = String(original.metadata?.documentId ?? "");
      const document = documentMap.get(documentId);
      if (!document) return [];
      const project = document ? projectMap.get(document.projectId) : undefined;

      return [
        {
          documentId,
          projectId: document.projectId,
          projectName: project?.name ?? "",
          title: document.title,
          content: String(original.metadata?.text ?? ""),
          filePath: String(original.metadata?.filePath ?? ""),
          kind: castDocumentKind(String(original.metadata?.kind ?? options.kind)),
          publicationStatus: document.publicationStatus as PublicationStatus,
          similarity: original.score ?? 0,
          rerankScore: item.relevanceScore,
        },
      ];
    });
  },
};

async function getDocumentState(documentId: string) {
  const [row] = await db
    .select({
      id: projectDocuments.id,
      status: projectDocuments.status,
    })
    .from(projectDocuments)
    .where(eq(projectDocuments.id, documentId));

  return row ?? null;
}

async function getActiveDocument(documentId: string) {
  const [row] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, documentId));
  if (!row || isCancellationStatus(row.status)) {
    return null;
  }

  return row;
}

async function markDocumentProcessing(documentId: string) {
  const [row] = await db
    .update(projectDocuments)
    .set({
      status: "processing",
      parserError: null,
    })
    .where(
      and(
        eq(projectDocuments.id, documentId),
        or(
          eq(projectDocuments.status, "pending"),
          eq(projectDocuments.status, "processing"),
          eq(projectDocuments.status, "ready"),
          eq(projectDocuments.status, "error"),
        ),
      ),
    )
    .returning();

  return row ?? null;
}

async function getProjectOrThrow(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    throw new Error("Project not found");
  }
  return project;
}

async function getProjectSlug(projectId: string) {
  return (await getProjectOrThrow(projectId)).slug;
}

function defaultPublicationStatus(kind: DocumentKind): PublicationStatus {
  return kind === "runbook" ? "draft" : "active";
}

function normalizeDocumentMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

function buildIndexedState(vectorCount: number): DocumentIndexingState {
  return {
    indexingStatus: "indexed",
    indexingReason: null,
    indexedAt: new Date().toISOString(),
    vectorCount,
  };
}

function buildNotIndexedState(input: {
  extension: string | null;
  text: string;
  chunkCount: number;
  reason?: DocumentIndexingReason;
}): DocumentIndexingState {
  const trimmed = input.text.trim();
  let reason = input.reason ?? null;

  if (!reason) {
    if (isImageExtension(input.extension)) {
      reason = "image_without_ocr";
    } else if (!trimmed) {
      reason = "empty_content";
    } else if (input.chunkCount === 0) {
      reason = "empty_chunks";
    } else {
      reason = "index_write_skipped";
    }
  }

  return {
    indexingStatus: "not_indexed",
    indexingReason: reason,
    indexedAt: null,
    vectorCount: 0,
  };
}

function withIndexingMetadata(metadata: unknown, state: DocumentIndexingState) {
  return {
    ...normalizeDocumentMetadata(metadata),
    indexingStatus: state.indexingStatus,
    indexingReason: state.indexingReason,
    indexedAt: state.indexedAt,
    vectorCount: state.vectorCount,
  };
}

function deriveIndexingState(row: {
  metadata?: unknown;
  content?: string | null;
  chunkCount: number;
  embeddingModel: string | null;
  extension: string | null;
}): DocumentIndexingState {
  const metadata = normalizeDocumentMetadata(row.metadata);
  const metadataStatus = metadata.indexingStatus;
  const metadataReason = metadata.indexingReason;
  const metadataIndexedAt = metadata.indexedAt;
  const metadataVectorCount = metadata.vectorCount;

  if (isDocumentIndexingStatus(metadataStatus)) {
    return {
      indexingStatus: metadataStatus,
      indexingReason: isDocumentIndexingReason(metadataReason) ? metadataReason : null,
      indexedAt: typeof metadataIndexedAt === "string" ? metadataIndexedAt : null,
      vectorCount:
        typeof metadataVectorCount === "number" && Number.isFinite(metadataVectorCount)
          ? metadataVectorCount
          : metadataStatus === "indexed"
            ? row.chunkCount
            : 0,
    };
  }

  if (row.chunkCount > 0 && row.embeddingModel) {
    return {
      indexingStatus: "indexed",
      indexingReason: null,
      indexedAt: null,
      vectorCount: row.chunkCount,
    };
  }

  return buildNotIndexedState({
    extension: row.extension,
    text: row.content ?? "",
    chunkCount: row.chunkCount,
  });
}

function withPublicUrl<
  T extends {
    filePath: string;
    metadata?: unknown;
    content?: string | null;
    chunkCount: number;
    embeddingModel: string | null;
    extension: string | null;
  },
>(row: T) {
  const indexing = deriveIndexingState(row);
  return {
    ...row,
    fileUrl: toPublicFileUrl(row.filePath),
    ...indexing,
  };
}

async function extractDocumentText(
  relativePath: string,
  extension: string | null,
  inlineContent?: string | null,
) {
  if (extension === "md" && inlineContent) {
    return inlineContent;
  }

  if (extension === "md") {
    return readStoredText(relativePath);
  }

  if (isImageExtension(extension)) {
    return "";
  }

  if (!extension) {
    return inlineContent ?? "";
  }

  return extractText(resolveStoredPath(relativePath), extension);
}

async function createChunks(extension: string | null, text: string) {
  if (!text.trim()) return [];
  if (extension === "md") return chunkMarkdown(text);
  if (extension === "xlsx" || extension === "csv") return chunkTabularText(text);
  return chunkText(text);
}
