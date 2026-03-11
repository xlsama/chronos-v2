import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { client } from "@/lib/api";
import { NOTIFICATION_SCENARIOS } from "@/constants/notification";
import {
  notificationSettingsQueries,
  useUpdateNotificationSettings,
} from "@/lib/queries/notification-settings";

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
      <DialogContent className="max-w-6xl min-w-[900px] p-0 gap-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="flex h-[600px]">
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
          <ScrollArea className="flex-1 p-5 pt-2">
            {activeTab === "notifications" && <NotificationSettings />}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotificationSettings() {
  const [platform, setPlatform] = useState("feishu");
  const [draft, setDraft] = useState({ webhookUrl: "", signKey: "", enabled: true });
  const [testing, setTesting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery(notificationSettingsQueries.detail(platform));
  const updateMutation = useUpdateNotificationSettings();

  // Sync from server to draft when data loads
  useEffect(() => {
    if (settings && !initialized) {
      setDraft({
        webhookUrl: settings.webhookUrl ?? "",
        signKey: settings.signKey ?? "",
        enabled: settings.enabled ?? true,
      });
      setInitialized(true);
    } else if (!settings && !isLoading && !initialized) {
      setDraft({ webhookUrl: "", signKey: "", enabled: true });
      setInitialized(true);
    }
  }, [settings, isLoading, initialized]);

  // Reset initialized when platform changes
  useEffect(() => {
    setInitialized(false);
  }, [platform]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        platform,
        data: {
          webhookUrl: draft.webhookUrl,
          signKey: draft.signKey || undefined,
          enabled: draft.enabled,
        },
      },
      {
        onSuccess: () => toast.success("保存成功"),
      },
    );
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await client.api.webhooks.test.$post({
        json: {
          webhookUrl: draft.webhookUrl,
          signKey: draft.signKey || undefined,
          platform: "feishu" as const,
        },
      });
      const json = await res.json();
      if (!res.ok) {
        const errorJson = json as { error: string };
        throw new Error(errorJson.error);
      }
      toast.success("测试消息发送成功");
    } catch (err) {
      toast.error("测试消息发送失败", {
        description: err instanceof Error ? err.message : "未知错误",
      });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">通知</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleHelp className="text-muted-foreground size-4 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="mb-2 font-medium">通知触发场景</p>
              <ul className="space-y-1.5">
                {NOTIFICATION_SCENARIOS.map((s) => (
                  <li key={s.title} className="text-xs">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground"> - {s.description}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>
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
            <div className="flex items-center justify-between">
              <Label>启用通知</Label>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, enabled: checked }))}
              />
            </div>

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

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!draft.webhookUrl.trim() || testing}
          >
            {testing && <Loader2 className="animate-spin" />}
            测试
          </Button>
          <Button onClick={handleSave} disabled={!draft.webhookUrl.trim() || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="animate-spin" />}
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
