---
name: "MySQL 数据诊断"
description: "当事件指向 MySQL 数据异常、查询结果错误、批量更新污染、外键关系异常、慢查询或配置问题时使用。通过只读 MySQL MCP 查询 schema、样本数据和聚合结果定位根因。"
mcpServers:
  - mysql
applicableServiceTypes:
  - mysql
riskLevel: read-only
---

# MySQL 数据诊断

## 任务目标

- 用只读 MySQL 查询确认异常数据的范围、结构和来源，避免凭业务假设直接下结论。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 MySQL MCP；如需额外工具，只能在说明用途后使用 `runContainerCommand`。
- 先探测 schema，再做数据验证，不要预设业务表名或日志表存在。

## 推荐流程

1. 确认项目中存在 MySQL 服务，并激活 MCP。
2. 先列出数据库、表和列，确认可能相关的 schema，不要直接猜 `orders`、`products` 或 `app_errors`。
3. 用聚合、样本和 `LIMIT` 查询确认异常范围，再做关联查询。
4. 只有在确认表关系和关键字段后，才做 JOIN 或时间线分析。
5. 最终用“异常分布 + 结构信息 + 关键样本”支撑结论。

## 查询策略

- 先做 `SHOW DATABASES`、`SHOW TABLES`、`DESCRIBE` 或等价结构探测，再写业务 SQL。
- 对异常值问题优先用 `COUNT`、`GROUP BY`、区间统计和样本数据验证，不要直接全表明细扫描。
- JOIN 前先确认主键、外键或可验证关联键，避免凭命名猜关系。
- 只有在 schema 里确实存在审计表、错误表或变更表时，再把它们纳入证据链。

## 风险边界

- 默认只读，只执行查询和结构探测。
- 遇到大表时必须先收敛条件、带 `LIMIT` 或使用聚合；不要执行可能拖垮实例的无界查询。

## 输出要求

- 最终回复必须写明：受影响的库表、关键结构或聚合证据、异常样本、根因判断，以及是否已经激活 MCP。
