# Case 4: MySQL 商品价格异常导致零元订单

## 场景

电商平台运营人员执行了一条错误的批量 SQL，将“数码配件”分类下所有商品的 `price` 设为 `0`。随后前端展示零价商品，订单创建出现金额为 `0` 的异常订单，并被支付网关拒绝。

## 架构

| 组件 | 说明 |
|------|------|
| case4-mysql (33306) | 模拟生产 MySQL 8.0（`shop_service`） |
| Chronos Backend | AI Agent 分析平台 |

### 复用的内置 Skill

- `mysql-data-diagnosis`
- MCP Server: `@benborla29/mcp-server-mysql`
- 本 case 仅创建项目、服务和知识库，不再创建 case 私有 skill

## 运行方式

```bash
# 前提：后端已运行 (pnpm dev:backend)
pnpm test:case-4
```

## 预期 Agent 流程

1. 列出项目服务，确认 MySQL 承载商品与订单链路数据。
2. 加载通用 `mysql-data-diagnosis` 并激活 MySQL MCP。
3. 先做 schema 发现，再定位异常数据集中在哪类商品和哪段交易链路。
4. 结合商品、订单和错误记录判断影响范围与根因。
5. 输出结论，保存 incident history，并关闭事件。

## 验证项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Incident 状态 | 变为 `resolved` 或 `closed` |
| 2 | 价格异常识别 | Agent 提到 price=0 或零元 |
| 3 | MCP 使用 | Agent 通过 MySQL MCP 执行了查询 |
| 4 | 事件历史 | 生成了 incident_history 文档 |

## 故障排查

- **内置 Skill 未出现**: 检查 [SKILL.md](/Users/xlsama/w/chronos-v2/apps/backend/data/skills/mysql-data-diagnosis/SKILL.md)
- **Agent 超时**: 查看后端日志
- **MySQL 连接失败**: 确认 `mysql -h 127.0.0.1 -P 33306 -u root -proot123` 可连接
