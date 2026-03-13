---
name: "Grafana 仪表板诊断"
description: "当事件指向 Grafana Dashboard、告警面板、服务性能问题、资源使用异常或需要通过 Grafana 代理查询数据源时使用。通过只读 Grafana MCP 搜索仪表板、面板和数据源查询定位根因。"
mcpServers:
  - grafana
applicableServiceTypes:
  - grafana
riskLevel: read-only
---

# Grafana 仪表板诊断

## 任务目标

- 用只读 Grafana MCP 找到相关 Dashboard、面板和数据源结果，用图表上下文支撑根因判断。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 Grafana MCP 搜索 Dashboard 和查询面板；必要时可配合 `runContainerCommand` 检查容器内现有命令。
- 如果 Grafana 只是数据入口，而真正证据来自 Prometheus、Loki 或 Elasticsearch，可在确认后切换到对应 skill 下钻。

## 推荐流程

1. 确认项目中存在 Grafana 服务，并激活 MCP。
2. 先搜索与告警服务、业务域或告警名称相关的 Dashboard，不要先猜面板 UID。
3. 查看 Dashboard 结构后，找最贴近告警症状的面板和数据源。
4. 只对相关面板执行数据源查询，并围绕异常时间窗做对比。
5. 如果 Grafana 面板已明确指向某个下游服务或指标，再用对应 skill 深挖。

## 查询策略

- 先搜索和浏览 Dashboard，再决定查什么指标；不要脱离面板上下文直接猜 PromQL。
- 图表异常要结合时间范围、标签维度和面板说明解释，不要只看单个时间点。
- 如果不同面板指向不同方向，优先找时间上最先出现异常的指标。
- 对资源类问题优先看趋势和占比，对错误类问题优先看 rate 和分位数。

## 风险边界

- 默认只读，不修改 Dashboard、文件夹、告警规则或数据源配置。
- 如果缺少 Grafana token、viewer 权限不足或相关面板不存在，直接说明并选择其他证据路径。

## 输出要求

- 最终回复必须写明：所用 Dashboard 或面板、关键图表或查询证据、时间范围、根因判断，以及是否已经激活 MCP。
