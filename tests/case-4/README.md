# Case 4: MySQL 商品价格异常导致零元订单

## 场景

电商平台运营人员执行了一条错误的批量 SQL，将"数码配件"分类下所有商品的 `price` 设为 0。导致前端下单后生成零元订单，订单校验服务不断报错。

## 架构

| 组件 | 说明 |
|------|------|
| case4-mysql (33306) | 模拟生产 MySQL 8.0（shop_service 数据库） |
| Chronos Backend | AI Agent 分析平台 |

### 数据库表

- `categories` — 商品分类（3 个：数码配件、服装鞋包、家居用品）
- `products` — 商品信息（15 个，其中数码配件分类 5 个 price=0）
- `orders` — 订单记录（10 条，其中 4 条 total=0）
- `app_errors` — 应用错误日志（8 条）

### 使用的 Skill

**MySQL Data Diagnosis** (`mysql-data-diagnosis`)
- MCP Server: `@benborla29/mcp-server-mysql`
- 适用服务类型: `mysql`

## 运行步骤

### 前置条件

- Docker 已安装并运行
- Chronos 后端已启动（默认 http://localhost:8000）
- MySQL 客户端可用（`mysql` 命令行工具）
- `jq` 已安装

### 执行

```bash
cd tests/case-4

# 1. 启动模拟生产环境
docker compose up -d --wait

# 2. 初始化数据 + 创建 Chronos 项目/服务/知识库/Skill
bash seed.sh

# 3. 触发告警 → Agent 自动处理 → 验证结果
bash trigger.sh

# 4. 清理所有资源
bash cleanup.sh
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHRONOS_API_URL` | `http://localhost:8000` | Chronos 后端地址 |
| `MYSQL_HOST` | `127.0.0.1` | MySQL 主机 |
| `MYSQL_PORT` | `33306` | MySQL 端口 |
| `MAX_WAIT` | `300` | 等待 Agent 处理的最大秒数 |

## 预期 Agent 流程

1. 搜索知识库 → 找到商品服务数据库架构文档
2. 列出 Skills → 找到 MySQL Data Diagnosis
3. 加载 Skill → 读取诊断方法论
4. 列出项目服务 → 找到 MySQL 连接
5. 激活 MCP → 启动 MySQL MCP Server
6. 执行 SQL → 查询 products 表 price=0 的商品
7. 执行 SQL → 查询 orders 表异常订单
8. 执行 SQL → 查询 app_errors 错误日志
9. 分析根因：数码配件分类商品价格被错误设为 0
10. 更新 Incident 状态为 resolved
11. 保存事件历史
12. 关闭 MCP

## 验证项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Incident 状态 | 变为 `resolved` 或 `closed` |
| 2 | 价格异常识别 | Agent 提到 price=0 或零元 |
| 3 | MCP 使用 | Agent 通过 MySQL MCP 执行了查询 |
| 4 | 事件历史 | 生成了 incident_history 文档 |

## 故障排查

- **MCP 激活失败**: 检查 `data/skills/mysql-data-diagnosis/skill.config.json` 是否存在
- **知识库无结果**: 检查文档状态是否为 `ready`（seed.sh 会等待）
- **Agent 超时**: 增加 `MAX_WAIT` 或查看后端日志
- **MySQL 连接失败**: 确认 Docker 容器健康，`mysql -h 127.0.0.1 -P 33306 -u root -proot123` 可连接
