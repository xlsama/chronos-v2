---
name: mysql-slow-query
description: "诊断和解决 MySQL 慢查询问题，包括 EXPLAIN 分析、索引优化、查询改写"
category: database
tags: ["mysql", "slow-query", "performance", "index"]
required_mcp_servers: []
risk_level: medium
---

# MySQL 慢查询诊断

## 排查思路
1. 首先通过 SHOW PROCESSLIST 查看当前执行的慢查询
2. 使用 EXPLAIN 分析查询执行计划
3. 检查是否缺少索引
4. 查看慢查询日志中的高频查询

## 常用命令
- `mysql -h {host} -u {user} -p -e "SHOW FULL PROCESSLIST"` - 查看当前进程
- `mysql -h {host} -u {user} -p -e "EXPLAIN {query}"` - 分析执行计划
- `mysql -h {host} -u {user} -p -e "KILL QUERY {id}"` - 终止慢查询
- `mysqldumpslow -s t /var/log/mysql/slow.log` - 分析慢查询日志

## 常见原因
- 缺少索引（全表扫描）
- 索引失效（类型转换、函数调用）
- 锁等待（`SHOW ENGINE INNODB STATUS`）
- 大事务未提交
- 临时表/文件排序

## 修复操作
- 添加索引（注意：生产环境使用 `pt-online-schema-change`）
- `KILL QUERY {id}` 终止阻塞查询
- 优化查询语句（避免 SELECT *、减少子查询）
- 调整 `innodb_buffer_pool_size` 等参数

## 风险提示
- `KILL QUERY` 可能导致事务回滚
- 添加索引在大表上可能锁表，建议使用 `pt-osc`
- 修改参数需要评估内存影响
