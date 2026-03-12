"use client"

import type { Attachment } from "@chronos/shared"
import { AlertCircle, ExternalLink, FileIcon, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Streamdown } from "streamdown"
import { Button } from "@/components/ui/button"
import { CodeBlock, CodeBlockCode } from "@/components/ui/code-block"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImageLightbox } from "@/components/ui/image-lightbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AttachmentItem } from "@/hooks/use-file-upload"

const TEXT_PREVIEW_LIMIT_BYTES = 1024 * 1024

const MARKDOWN_EXTENSIONS = new Set(["md", "mdx", "markdown"])

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bash: "bash",
  c: "c",
  conf: "ini",
  cpp: "cpp",
  css: "css",
  cxx: "cpp",
  dockerfile: "dockerfile",
  go: "go",
  h: "c",
  hpp: "cpp",
  htm: "html",
  html: "html",
  ini: "ini",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  kt: "kotlin",
  less: "less",
  log: "plaintext",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  svg: "xml",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "plaintext",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
}

const LANGUAGE_BY_MIME: Record<string, string> = {
  "application/javascript": "javascript",
  "application/json": "json",
  "application/ld+json": "json",
  "application/sql": "sql",
  "application/toml": "toml",
  "application/typescript": "typescript",
  "application/x-httpd-php": "php",
  "application/x-sh": "bash",
  "application/xml": "xml",
  "text/css": "css",
  "text/csv": "plaintext",
  "text/html": "html",
  "text/javascript": "javascript",
  "text/plain": "plaintext",
  "text/x-python": "python",
  "text/xml": "xml",
}

type FilePreviewKind =
  | { type: "markdown" }
  | { type: "code"; language: string }
  | { type: "unsupported" }

type AttachmentPreviewSource = {
  kind: "image" | "file"
  name: string
  mimeType: string
  url?: string
  file?: File
  imageSrc?: string
}

type FilePreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "too-large" }
  | { status: "error"; message: string }

class PreviewTooLargeError extends Error {}

function getFileExtension(filename: string): string {
  const normalized = filename.trim().toLowerCase()
  if (!normalized) return ""
  if (normalized === "dockerfile") return "dockerfile"
  const lastDot = normalized.lastIndexOf(".")
  return lastDot === -1 ? "" : normalized.slice(lastDot + 1)
}

function getFilePreviewKind(source: AttachmentPreviewSource): FilePreviewKind {
  const extension = getFileExtension(source.name)
  const mimeType = source.mimeType.toLowerCase()

  if (
    MARKDOWN_EXTENSIONS.has(extension) ||
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown"
  ) {
    return { type: "markdown" }
  }

  const languageFromExtension = LANGUAGE_BY_EXTENSION[extension]
  if (languageFromExtension) {
    return { type: "code", language: languageFromExtension }
  }

  const languageFromMime = LANGUAGE_BY_MIME[mimeType]
  if (languageFromMime) {
    return { type: "code", language: languageFromMime }
  }

  if (mimeType.startsWith("text/")) {
    return { type: "code", language: "plaintext" }
  }

  return { type: "unsupported" }
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof PreviewTooLargeError) {
    return "文件过大，无法内嵌预览。"
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "加载预览失败。"
}

async function readPreviewText(source: AttachmentPreviewSource): Promise<string> {
  if (source.file) {
    if (source.file.size > TEXT_PREVIEW_LIMIT_BYTES) {
      throw new PreviewTooLargeError()
    }

    return source.file.text()
  }

  if (!source.url) {
    throw new Error("当前文件没有可用地址。")
  }

  const response = await fetch(source.url)
  if (!response.ok) {
    throw new Error(`加载文件失败（${response.status}）`)
  }

  const contentLength = response.headers.get("content-length")
  if (contentLength && Number(contentLength) > TEXT_PREVIEW_LIMIT_BYTES) {
    throw new PreviewTooLargeError()
  }

  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > TEXT_PREVIEW_LIMIT_BYTES) {
    throw new PreviewTooLargeError()
  }

  return text
}

function useLocalFileUrl(file?: File) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return url
}

function FilePreviewFallback(props: {
  title: string
  description: string
  openUrl?: string | null
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <FileIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{props.title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{props.description}</p>
      </div>
      {props.openUrl ? (
        <Button asChild>
          <a href={props.openUrl} target="_blank" rel="noopener noreferrer">
            打开原文件
            <ExternalLink className="size-4" />
          </a>
        </Button>
      ) : null}
    </div>
  )
}

function FilePreviewContent(props: { source: AttachmentPreviewSource }) {
  const previewKind = useMemo(() => getFilePreviewKind(props.source), [props.source])
  const fallbackUrl = useLocalFileUrl(props.source.file)
  const [state, setState] = useState<FilePreviewState>({ status: "idle" })

  useEffect(() => {
    let active = true

    if (previewKind.type === "unsupported") {
      setState({ status: "idle" })
      return () => {
        active = false
      }
    }

    setState({ status: "loading" })

    void readPreviewText(props.source)
      .then((text) => {
        if (!active) return
        setState({ status: "ready", text })
      })
      .catch((error) => {
        if (!active) return

        if (error instanceof PreviewTooLargeError) {
          setState({ status: "too-large" })
          return
        }

        setState({ status: "error", message: getReadableErrorMessage(error) })
      })

    return () => {
      active = false
    }
  }, [previewKind, props.source])

  const openUrl = props.source.url ?? fallbackUrl

  if (previewKind.type === "unsupported") {
    return (
      <FilePreviewFallback
        title="暂不支持内嵌预览"
        description="这个文件类型会直接回退到原文件查看。"
        openUrl={openUrl}
      />
    )
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (state.status === "too-large") {
    return (
      <FilePreviewFallback
        title="文件过大"
        description="超过 1 MiB 的文本文件不会做内嵌预览，请直接打开原文件查看。"
        openUrl={openUrl}
      />
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">加载预览失败</p>
          <p className="max-w-md text-sm text-muted-foreground">{state.message}</p>
        </div>
        {openUrl ? (
          <Button asChild variant="outline">
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              打开原文件
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null}
      </div>
    )
  }

  if (previewKind.type === "markdown") {
    return (
      <ScrollArea className="h-[72vh] lg:h-[76vh]">
        <div className="px-6 py-5 sm:px-8 sm:py-6 lg:px-10">
          <Streamdown
            mode="static"
            className="prose prose-sm max-w-none break-words dark:prose-invert"
          >
            {state.text}
          </Streamdown>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-[72vh] bg-muted/20 lg:h-[76vh]">
      <div className="p-5 sm:p-6 lg:p-8">
        <CodeBlock className="overflow-hidden">
          <CodeBlockCode code={state.text} language={previewKind.language} />
        </CodeBlock>
      </div>
    </ScrollArea>
  )
}

export function attachmentToPreviewSource(
  attachment: Attachment
): AttachmentPreviewSource {
  return {
    kind: attachment.type,
    name: attachment.name,
    mimeType: attachment.mimeType,
    url: attachment.url,
    imageSrc: attachment.type === "image" ? attachment.url : undefined,
  }
}

export function attachmentItemToPreviewSource(
  item: AttachmentItem
): AttachmentPreviewSource {
  const isImage =
    item.file.type.startsWith("image/") ||
    (item.status === "done" && item.attachment.type === "image")

  return {
    kind: isImage ? "image" : "file",
    name: item.status === "done" ? item.attachment.name : item.file.name,
    mimeType:
      item.status === "done"
        ? item.attachment.mimeType
        : item.file.type || "application/octet-stream",
    url: item.status === "done" ? item.attachment.url : undefined,
    file: item.file,
    imageSrc:
      item.previewUrl ??
      (item.status === "done" && item.attachment.type === "image"
        ? item.attachment.url
        : undefined),
  }
}

export function AttachmentPreviewDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: AttachmentPreviewSource | null
}) {
  if (!props.preview) return null

  if (props.preview.kind === "image") {
    const src = props.preview.imageSrc ?? props.preview.url

    if (!src) return null

    return (
      <ImageLightbox
        open={props.open}
        onOpenChange={props.onOpenChange}
        src={src}
        alt={props.preview.name}
      />
    )
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-6xl xl:max-w-7xl">
        <DialogHeader className="gap-1 border-b px-5 py-4 pr-14 sm:px-6 lg:px-8">
          <DialogTitle className="truncate text-base">{props.preview.name}</DialogTitle>
          <p className="truncate text-sm text-muted-foreground">
            {props.preview.mimeType || "未知文件类型"}
          </p>
        </DialogHeader>
        <FilePreviewContent source={props.preview} />
      </DialogContent>
    </Dialog>
  )
}
