import { useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settings";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabs = [{ id: "notifications", label: "通知", icon: Bell }] as const;

type TabId = (typeof tabs)[number]["id"];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("notifications");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-w-[720px] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="flex h-[480px]">
          <nav className="flex w-48 shrink-0 flex-col gap-1 border-r p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </nav>
          <ScrollArea className="flex-1 p-6 pt-0">
            {activeTab === "notifications" && <NotificationSettings />}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotificationSettings() {
  const { feishu, setFeishu } = useSettingsStore();
  const [platform, setPlatform] = useState("feishu");
  const [draft, setDraft] = useState(feishu);

  const handleSave = () => {
    setFeishu(draft);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">通知</h3>
        <p className="text-muted-foreground text-sm">配置告警通知集成</p>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>集成平台</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feishu">飞书</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {platform === "feishu" && (
          <>
            <div className="grid gap-2">
              <Label>
                Webhook URL <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.webhookUrl}
                onChange={(e) => setDraft((d) => ({ ...d, webhookUrl: e.target.value }))}
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
              />
              <p className="text-muted-foreground text-xs">飞书自定义机器人的 Webhook 地址</p>
            </div>
            <div className="grid gap-2">
              <Label>签名密钥</Label>
              <Input
                type="password"
                value={draft.signKey}
                onChange={(e) => setDraft((d) => ({ ...d, signKey: e.target.value }))}
                placeholder="可选，用于 HMAC-SHA256 签名验证"
              />
              <p className="text-muted-foreground text-xs">
                飞书机器人安全设置中的 Sign Key，留空则不启用签名校验
              </p>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button onClick={handleSave} disabled={!draft.webhookUrl.trim()}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
