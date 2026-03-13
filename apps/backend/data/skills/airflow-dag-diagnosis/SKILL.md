---
name: "Airflow DAG 诊断"
description: "当事件指向 Airflow DAG、任务实例失败、调度延迟、依赖阻塞、Worker 异常或数据管道停滞时使用。通过只读 Airflow MCP 查询定位失败 DAG、任务日志和调度瓶颈。"
mcpServers:
  - airflow
applicableServiceTypes:
  - airflow
riskLevel: read-only
---

# Airflow DAG 诊断

## 任务目标

- 用只读 Airflow MCP 确认失败 DAG、失败任务、调度延迟和阻塞点，给出可验证的根因。

## 运行上下文

- 该 skill 由 Chronos Supervisor Agent 在服务端容器中执行，不依赖用户本机环境。
- 优先使用 `loadSkill`、`activateSkillMcp` 和 `executeMcpTool` 完成诊断。
- 如果 MCP 缺少某个探测能力，可使用 `runContainerCommand` 检查容器内现有命令；确有必要时可安装 CLI，但要先说明用途和影响。
- 完成诊断后停用 MCP，并在结论里说明关键查询与证据。

## 推荐流程

1. 用 `listProjectServices` 或 `getServiceDetails` 确认 Airflow 服务和访问配置。
2. 激活 MCP 后先列出 DAG、最近的 DAG Run 和相关 Task Instance，不要先猜 DAG ID。
3. 优先定位最近失败、长时间 running、频繁 retry 或明显延迟的 DAG Run。
4. 围绕异常 DAG 下钻到 task 状态、依赖关系、日志和调度时间差。
5. 拿到足够证据后输出根因、影响范围和后续建议，再停用 MCP。

## 查询策略

- 先按时间范围查最近失败或异常耗时的 DAG Run，再看单个 task，不要一开始就拉全量日志。
- 用 task instance 状态定位第一个失败、`upstream_failed`、`skipped` 或持续 retry 的任务。
- 将“调度延迟”和“任务执行失败”分开判断：前者优先看 scheduler、队列和 worker 饱和，后者优先看任务日志和外部依赖。
- 只有在确认 DAG 或 task 名后再查看更细的变量、连接或历史记录。

## 风险边界

- 默认只读，不触发 DAG Run、不清理任务状态、不修改变量或连接。
- 如果缺少 Airflow URL、凭据或项目里没有匹配服务，直接报告阻塞，不要编造结果。

## 输出要求

- 最终回复必须写明：异常 DAG、异常 task、关键状态或日志证据、根因判断，以及是否已经激活 MCP。
