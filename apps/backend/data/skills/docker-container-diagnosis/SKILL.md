---
name: "Docker 容器诊断"
description: "当事件指向 Docker 容器崩溃、频繁重启、资源耗尽、网络异常、镜像问题或容器日志错误时使用。通过 Docker MCP 查询容器状态、inspect 信息、日志和资源使用定位根因。"
mcpServers:
  - docker
applicableServiceTypes:
  - docker
riskLevel: read-only
---

# Docker 容器诊断

## 任务目标

- 用 Docker MCP 确认异常容器、退出原因、资源压力和网络配置问题，形成可验证的根因判断。

## 运行上下文

- 该 skill 在 Chronos 后端容器中执行，不依赖用户本机环境。
- 优先使用 Docker MCP；只有在 MCP 无法覆盖某个探测点时，才使用 `runContainerCommand` 检查 Docker CLI 或 socket。
- 如果确需安装 CLI，先说明用途和影响。

## 推荐流程

1. 先确认项目中存在 Docker 服务，并尝试激活 MCP。
2. 先列出容器和状态，定位 `restarting`、`exited`、健康检查失败或最近重建的容器。
3. 对异常容器查看 inspect、日志、资源限制和网络配置。
4. 将退出码、健康检查、日志关键字和资源指标组合起来判断根因。
5. MCP 不可用时，再用 `runContainerCommand` 检查 docker socket、docker CLI 或相关权限。

## 查询策略

- 先从容器概览缩小范围，再读取单个容器的日志和详细配置。
- 将 `Exited`、`Restarting`、OOM、健康检查失败、镜像拉取失败分开判断，不要只凭一条日志下结论。
- 资源问题优先对比实时使用量和限制值；网络问题优先看端口映射、网络附着和依赖容器状态。
- 如果告警发生在部署后，重点看最新创建容器和镜像标签变化。

## 风险边界

- 默认只读，不执行 `start`、`stop`、`rm`、`exec` 或镜像变更操作。
- 如果 Docker socket、Docker API 或权限不可用，直接报告阻塞。

## 输出要求

- 最终回复必须写明：异常容器、关键状态或退出码、关键日志或 inspect 证据、根因判断，以及是否已经激活 MCP。
