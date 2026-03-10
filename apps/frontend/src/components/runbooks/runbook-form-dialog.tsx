import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateRunbook } from "@/lib/queries/runbooks";

interface RunbookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RunbookFormDialog({ open, onOpenChange }: RunbookFormDialogProps) {
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const navigate = useNavigate();
  const createMutation = useCreateRunbook();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createMutation.mutate(
      { title: title.trim(), content: "", tags },
      {
        onSuccess: (runbook) => {
          onOpenChange(false);
          setTitle("");
          setTagsInput("");
          navigate({ to: "/runbooks/$id", params: { id: runbook.id } });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新建 Runbook</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如: MySQL 主从切换 Runbook"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tags">标签</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="用逗号分隔，例如: mysql, 故障恢复"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
