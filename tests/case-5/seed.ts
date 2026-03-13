import postgres from 'postgres'
import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
} from '../helpers/chronos-api'

const PG_HOST = process.env.PG_HOST ?? '127.0.0.1'
const PG_PORT = Number(process.env.PG_PORT ?? 35432)
const PG_USER = 'analytics'
const PG_PASSWORD = 'analytics123'
const PG_DATABASE = 'analytics_service'

const SEED_SQL = `
DROP TABLE IF EXISTS app_errors;
DROP TABLE IF EXISTS daily_reports;
DROP TABLE IF EXISTS data_sources;
DROP TABLE IF EXISTS scheduled_jobs;

CREATE TABLE scheduled_jobs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  cron_expression VARCHAR(50) NOT NULL,
  handler VARCHAR(200) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  run_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO scheduled_jobs (job_name, cron_expression, handler, is_enabled, last_run_at, next_run_at, run_count, status, error_message) VALUES
  ('generate_daily_report', '0 2 * * *', 'ReportGenerator.run',  false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', 127, 'disabled', 'Job disabled by system upgrade at 2026-03-09 03:15:00'),
  ('hourly_data_sync',      '0 * * * *', 'DataSyncer.sync',      true,  NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '30 minutes', 2184, 'idle', NULL),
  ('weekly_cleanup',         '0 3 * * 0', 'DataCleaner.cleanup',  true,  NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', 52, 'idle', NULL);

CREATE TABLE daily_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC(15,2) NOT NULL,
  department VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'generated',
  generated_by VARCHAR(50) NOT NULL DEFAULT 'scheduled_job',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO daily_reports (report_date, metric_name, metric_value, department, status, generated_by) VALUES
  (CURRENT_DATE - 7, 'daily_active_users', 15230.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 7, 'revenue',            892500.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 6, 'daily_active_users', 14890.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 6, 'revenue',            876300.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 5, 'daily_active_users', 15670.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 5, 'revenue',            912100.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 4, 'daily_active_users', 16100.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 4, 'revenue',            945800.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 3, 'daily_active_users', 15890.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 3, 'revenue',            923400.00, '销售部', 'generated', 'generate_daily_report');

CREATE TABLE data_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  connection_info JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'idle',
  record_count INT NOT NULL DEFAULT 0
);

INSERT INTO data_sources (name, source_type, connection_info, last_sync_at, sync_status, record_count) VALUES
  ('用户行为数据库', 'postgresql',    '{"host": "user-db.internal", "database": "user_behavior"}',          NOW() - INTERVAL '1 hour',       'synced', 2850000),
  ('订单数据库',     'mysql',         '{"host": "order-db.internal", "database": "orders"}',                 NOW() - INTERVAL '1 hour',       'synced', 1230000),
  ('日志存储',       'elasticsearch', '{"url": "http://es.internal:9200", "index": "app-logs"}',             NOW() - INTERVAL '45 minutes',   'synced', 58000000);

CREATE TABLE app_errors (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  service VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack_trace TEXT
);

INSERT INTO app_errors (timestamp, service, level, message, stack_trace) VALUES
  (NOW() - INTERVAL '3 days' + INTERVAL '2 hours 5 minutes', 'report-scheduler', 'warn',  'Scheduled job ''generate_daily_report'' skipped: job is disabled', NULL),
  (NOW() - INTERVAL '2 days' + INTERVAL '2 hours 5 minutes', 'report-scheduler', 'warn',  'Scheduled job ''generate_daily_report'' skipped: job is disabled', NULL),
  (NOW() - INTERVAL '1 day'  + INTERVAL '2 hours 5 minutes', 'report-scheduler', 'warn',  'Scheduled job ''generate_daily_report'' skipped: job is disabled', NULL),
  (NOW() - INTERVAL '2 days',                                 'dashboard-api',    'error', 'Report data stale: latest report_date is 3 days old, expected today', 'at DashboardService.checkFreshness (dashboard.js:142)'),
  (NOW() - INTERVAL '1 day',                                  'dashboard-api',    'error', 'Report data stale: latest report_date is 4 days old, expected today', 'at DashboardService.checkFreshness (dashboard.js:142)'),
  (NOW() - INTERVAL '2 hours',                                'bi-gateway',       'error', 'BI dashboard refresh failed: no data for date range 2026-03-10 to 2026-03-12', 'at BIGateway.fetchReports (gateway.js:89)');
`

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
}

export async function seed(): Promise<SeedResult> {
  console.log('[1/4] 初始化 PostgreSQL 数据...')
  const sql = postgres({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DATABASE,
  })

  await sql.unsafe(SEED_SQL)
  await sql.end()
  console.log('  ✓ PostgreSQL 数据初始化完成')

  console.log('[2/4] 创建 Chronos 项目...')
  const project = await createProject({
    name: '数据分析平台',
    description: '数据分析平台负责定时聚合业务数据并生成 BI 报表。当前故障表现为日报任务停摆，导致最近 3 天看板数据缺失。',
    tags: ['analytics', 'postgresql', 'bi'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  console.log('[3/4] 添加 PostgreSQL 服务连接...')
  const service = await addService(project.id, {
    name: '分析平台 PostgreSQL',
    type: 'postgresql',
    description: '分析平台主数据库，排查入口集中在 scheduled_jobs、daily_reports、data_sources、app_errors。',
    config: {
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      username: PG_USER,
      password: PG_PASSWORD,
    },
    metadata: {
      preferredSkillSlug: 'postgresql-ops-diagnosis',
      keyTables: ['scheduled_jobs', 'daily_reports', 'data_sources', 'app_errors'],
      criticalJob: 'generate_daily_report',
      diagnosticChecks: [
        '先确认 latest report_date',
        '再查 generate_daily_report 的 is_enabled / status / last_run_at',
        '再看 app_errors 中的 disabled / stale data 线索',
        '最后确认 data_sources 同步是否正常',
      ],
      upstreamServices: ['dashboard-api', 'bi-gateway'],
      downstreamDataConsumers: ['BI dashboards', 'department reports'],
    },
  })
  console.log(`  ✓ PostgreSQL 服务已添加: ${service.id}`)

  console.log('[4/4] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: '数据分析平台报表架构文档',
    tags: 'postgresql,analytics,report,scheduled-job',
    description: '数据分析平台报表架构、定时任务配置、数据源链路和报表缺失排查。',
  })
  console.log(`  ✓ 知识库文档已上传: ${kb.id}`)

  await waitForKnowledgeReady(project.id, kb.id)
  console.log('  ✓ 文档索引完成')

  return {
    projectId: project.id,
    serviceId: service.id,
    kbId: kb.id,
  }
}
