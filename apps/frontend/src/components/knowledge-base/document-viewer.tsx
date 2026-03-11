import type { KbDocument } from "@chronos/shared";

interface DocumentViewerProps {
  document: KbDocument;
}

export function DocumentViewer({ document }: DocumentViewerProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-lg border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">类型</span>
          <span>{document.type.toUpperCase()}</span>
        </div>
        {document.originalUrl && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">原始文件</span>
            <span>{document.originalUrl}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">文本块数</span>
          <span>{document.chunkCount}</span>
        </div>
        {document.errorMessage && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">错误信息</span>
            <span className="text-destructive">{document.errorMessage}</span>
          </div>
        )}
      </div>

      {document.content && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">提取的文本内容</h3>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm">
            {document.content}
          </pre>
        </div>
      )}
    </div>
  );
}
