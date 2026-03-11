import type { KbDocument } from "@chronos/shared";
import { useNavigate } from "@tanstack/react-router";
import { FileText, FileSpreadsheet, FileType } from "lucide-react";

import { DocumentStatusBadge } from "./document-status-badge";
import { useDeleteDocument } from "@/lib/queries/knowledge-base";

interface DocumentListProps {
  documents: KbDocument[];
  projectId: string;
}

const typeIcons: Record<string, typeof FileText> = {
  markdown: FileText,
  pdf: FileType,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  docx: FileText,
};

export function DocumentList({ documents, projectId }: DocumentListProps) {
  const navigate = useNavigate();

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-muted-foreground">
        <p>暂无文档</p>
        <p className="text-sm">点击"新建文档"添加知识库内容</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">标题</th>
            <th className="px-4 py-3 font-medium">类型</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">块数</th>
            <th className="px-4 py-3 font-medium">创建时间</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const Icon = typeIcons[doc.type] ?? FileText;
            return (
              <tr
                key={doc.id}
                className="cursor-pointer border-b last:border-b-0 hover:bg-accent"
                onClick={() =>
                  navigate({
                    to: "/knowledge-base/$projectId/$docId",
                    params: { projectId, docId: doc.id },
                  })
                }
              >
                <td className="px-4 py-3 font-medium">{doc.title}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Icon className="size-4" />
                    {doc.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DocumentStatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {doc.chunkCount}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString("zh-CN")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
