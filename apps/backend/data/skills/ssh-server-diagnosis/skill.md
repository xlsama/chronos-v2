---
name: "SSH 服务器诊断"
description: "通过 SSH 远程诊断服务器状态，包括系统资源、进程状态、日志分析和网络连通性"
mcpServers:
  - ssh
applicableServiceTypes:
  - ssh
riskLevel: read-only
---

# SSH 服务器诊断方法论

## 适用场景

- 服务器负载过高
- 磁盘空间不足
- 进程异常（僵尸进程、内存泄漏）
- 网络连通性问题
- 系统日志分析

## 诊断步骤

### 1. 检查系统资源

- `uptime`：查看系统负载和运行时间
- `free -h`：查看内存使用
- `df -h`：查看磁盘空间
- `top -bn1 | head -20`：查看 CPU 和进程概览

### 2. 检查进程状态

- `ps aux --sort=-rss | head -20`：按内存排序的进程
- `ps aux --sort=-%cpu | head -20`：按 CPU 排序的进程
- 查找异常进程（僵尸进程、CPU 100%、内存持续增长）

### 3. 检查系统日志

- `tail -100 /var/log/syslog` 或 `journalctl -n 100`
- 搜索 OOM killer、kernel panic 等关键信息
- 查看应用特定日志文件

### 4. 检查网络

- `ss -tlnp`：查看监听端口
- `netstat -an | grep ESTABLISHED | wc -l`：连接数统计
- 检查 DNS 解析和网络延迟

### 5. 检查磁盘 IO

- `iostat` 或 `iotop`：查看磁盘 IO 使用
- 检查是否有 IO wait 过高
- 查找大文件或快速增长的日志文件

### 6. 输出诊断结论

- 总结服务器异常的根因
- 提供关键指标数据
- 建议修复措施

## 常见模式

| 症状 | 根因 | 诊断命令 |
|------|------|----------|
| 负载高 | CPU 密集进程 | `top`, `ps aux --sort=-%cpu` |
| 内存满 | 内存泄漏 | `free -h`, `ps aux --sort=-rss` |
| 磁盘满 | 日志文件增长 | `df -h`, `du -sh /var/log/*` |
| 连接多 | 连接未释放 | `ss -s`, `netstat -an` |

## 安全注意事项

- 只执行诊断命令，不执行修改系统状态的操作
- 不执行 rm、kill、service stop 等破坏性命令
- 不读取敏感文件（/etc/shadow 等）
