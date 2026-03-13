# API 网关限流架构文档

## 概述

API 网关（API Gateway）是平台流量入口，负责请求路由、身份验证和**限流（Rate Limiting）**。限流配置存储在 Redis 中，网关在处理每个请求时实时读取 Redis 限流配置来决定是否放行。

## 服务链路与正常基线

- **上游**：客户端请求、发布脚本、alert-manager
- **核心组件**：api-gateway 读取 Redis 中的限流配置与错误日志
- **下游影响**：`/api/orders`、`/api/products`、`/api/users` 的业务流量会被直接拦截

正常情况下：
- `/api/orders` 的 `limit` 应为 `1000`
- `/api/products` 的 `limit` 应为 `2000`
- `/api/users` 的 `limit` 应为 `500`
- `/api/health` 保持高阈值，通常可作为正常基线

如果 `/api/health` 正常而多个业务 endpoint 同时 429，优先怀疑业务 endpoint 的限流配置，而不是 Redis 整体不可用。

## Redis 键命名规范

### 限流配置键

- 格式：`ratelimit:config:{endpoint}`
- 值：JSON 对象 `{"limit": <number>, "window": <seconds>}`
- 含义：在 `window` 秒的时间窗口内，该 endpoint 最多允许 `limit` 次请求
- **重要**：当 `limit` 设为 `0` 时，网关会拒绝所有到该 endpoint 的请求，返回 HTTP 429 Too Many Requests

示例：
```
ratelimit:config:/api/orders    → {"limit": 1000, "window": 60}
ratelimit:config:/api/products  → {"limit": 2000, "window": 60}
ratelimit:config:/api/users     → {"limit": 500, "window": 60}
ratelimit:config:/api/health    → {"limit": 10000, "window": 60}
```

### 限流计数器键

- 格式：`ratelimit:counter:{endpoint}:{ip}`
- 值：当前窗口内的请求计数（整数）
- TTL：与对应配置的 `window` 一致
- 网关逻辑：读取 counter，若 counter >= limit 则返回 429

### 功能开关键

- 格式：`feature:{name}`
- 值：`enabled` 或 `disabled`
- 用途：控制全局功能开关（如维护模式 `feature:maintenance_mode`）

### 错误日志键

- 格式：`errorlog:{id}`
- 值：JSON 对象，包含错误详情
- 用途：记录网关层面的错误事件，便于排查

## 常见故障场景及排查

### 大面积 429 错误

**现象**：多个 API endpoint 同时返回 429，但实际请求量远低于正常限额。

**排查步骤**：
1. 使用 `list` 工具枚举 `ratelimit:config:*` 模式的所有键
2. 逐一使用 `get` 工具读取每个限流配置键的值
3. 检查 `limit` 字段：若 `limit` 为 `0`，则该 endpoint 会拒绝所有请求
4. 检查 `errorlog:*` 键获取错误日志，确认 429 错误的时间线
5. 对比正常 endpoint（如 `/api/health`）和异常 endpoint 的配置差异

**常见根因**：
- 部署脚本错误地将限流配置的 `limit` 重置为 0
- 配置回滚不完整，导致部分 endpoint 配置丢失
- 手动操作 Redis 时误写入了错误值

### 诊断入口提示

- 第一跳优先查看 `ratelimit:config:*`
- 第二跳查看 `errorlog:*`，确认异常时间线和影响范围
- 如果限流配置正常，再看 `feature:*` 是否存在误开的全局开关

### 维护模式误开启

**现象**：所有请求被拒绝。

**排查**：检查 `feature:maintenance_mode` 键值是否为 `enabled`。
