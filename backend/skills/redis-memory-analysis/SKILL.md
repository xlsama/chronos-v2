---
name: redis-memory-analysis
description: "分析和优化 Redis 内存使用，处理内存溢出和大 Key 问题"
category: cache
tags: ["redis", "memory", "big-key", "performance"]
required_mcp_servers: []
risk_level: medium
---

# Redis 内存分析

## 排查思路
1. 检查 Redis 内存使用情况
2. 识别大 Key
3. 分析内存碎片率
4. 检查过期策略

## 常用命令
- `redis-cli -h {host} INFO memory` - 查看内存统计
- `redis-cli -h {host} --bigkeys` - 扫描大 Key
- `redis-cli -h {host} --memkeys` - 分析内存分布
- `redis-cli -h {host} MEMORY USAGE {key}` - 查看单个 Key 内存
- `redis-cli -h {host} DBSIZE` - 查看 Key 总数

## 常见原因
- 大 Key（Hash/Set/List 元素过多）
- 未设置过期时间
- 内存碎片率过高（`mem_fragmentation_ratio > 1.5`）
- maxmemory 设置过小

## 修复操作
- 拆分大 Key（使用 SCAN 分批删除）
- 设置合理的 TTL
- 执行 `MEMORY PURGE` 回收碎片
- 调整 `maxmemory` 和 `maxmemory-policy`

## 风险提示
- `DEL` 大 Key 可能阻塞 Redis，使用 `UNLINK` 异步删除
- 修改 `maxmemory-policy` 可能导致数据被淘汰
