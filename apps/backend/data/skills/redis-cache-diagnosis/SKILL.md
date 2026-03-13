---
name: "Redis 缓存诊断"
description: "诊断 Redis 缓存异常、连接问题、性能瓶颈，包括限流配置、功能开关、缓存数据完整性"
mcpServers:
  - redis
applicableServiceTypes:
  - redis
riskLevel: read-only
---

# Redis 缓存诊断方法论

## 适用场景

- 大面积 HTTP 429 限流错误
- 缓存命中率骤降
- Redis 连接超时或拒绝
- 功能开关状态异常
- 缓存数据不一致或过期

## 诊断步骤

### 1. 枚举相关键

根据告警信息确定需要检查的键模式，使用 `list` 工具枚举匹配的键：
- `list pattern="ratelimit:config:*"` 查看所有限流配置
- `list pattern="feature:*"` 查看功能开关
- `list pattern="cache:*"` 查看缓存数据

### 2. 逐一读取键值

对枚举到的每个键，使用 `get` 工具读取其值：
- 解析 JSON 值，检查关键字段是否正常
- 对于限流配置，重点检查 `limit` 字段是否为 0 或异常低值
- 对于功能开关，检查 enabled/disabled 状态

### 3. 检查错误日志

- `list pattern="errorlog:*"` 枚举错误日志键
- 逐一 `get` 读取错误日志内容
- 分析错误模式（如 429 错误的时间分布和影响范围）

### 4. 关联分析

- 对比正常和异常的配置值，找出差异
- 结合错误日志的时间线，判断异常发生的时间点
- 检查是否有批量修改操作的痕迹

### 5. 输出诊断结论

- 总结根因（如：限流配置的 limit 被设为 0）
- 列出受影响的 endpoint 和业务影响
- 提供修复建议

## 常见模式

| 症状 | 根因 | 查询方式 |
|------|------|----------|
| 全部 429 | limit=0 | `get ratelimit:config:*` |
| 缓存穿透 | key 不存在 | `list pattern="cache:*"` |
| 功能异常 | 开关误操作 | `get feature:*` |

## 安全注意事项

- 只读操作，不执行 DEL/FLUSHDB/SET 等写操作
- 注意大 key 的读取可能影响性能
