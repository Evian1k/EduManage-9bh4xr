# Production Operations

## Supabase Plan for 10M+ Users
- **Team** ($599/mo): 100K MAU, 100GB storage, 1000 realtime connections
- **Enterprise** (custom): 10M+ MAU, dedicated infrastructure, multi-region

## Connection Pooling
Always use pooled connection URL (port 6543):
```
postgresql://postgres.[REF]:[PWD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## Audit Log Partitioning
`audit_logs` partitioned by month. Cron auto-creates future partitions and drops partitions older than 12 months.

## Materialized Views
`mv_school_stats` — refreshed hourly by cron. O(1) dashboard queries.

## Multi-Region Read Replicas (Enterprise)
- Primary: US East (writes)
- Replica 1: EU West (reads)
- Replica 2: AP South (reads)

## Key Metrics
| Metric | Target | Alert |
|---|---|---|
| API p95 latency | < 500ms | > 1500ms for 5 min |
| API error rate | < 0.1% | > 1% for 2 min |
| DB connection pool | < 70% | > 90% |
| AI usage per school | < 80% | > 95% |
| Realtime connections | < 80% | > 90% |

## Backup Strategy
- Supabase daily backups (7-30 day retention)
- GitHub Actions daily pg_dump to S3 (30-day retention)
- RPO: 24 hours / RTO: 4 hours

## Secret Rotation
Rotate annually: AI keys, email/SMS keys, Stripe/M-Pesa keys, CRON_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

## Scaling Checklist
- [ ] Supabase Team or Enterprise plan
- [ ] Connection pooler URL in use
- [ ] All migrations applied
- [ ] Edge function secrets set
- [ ] Cron jobs scheduled
- [ ] Storage buckets with RLS
- [ ] Sentry integrated
- [ ] Load test passed (10K VUs, 0 tenant violations)
- [ ] Backup script running
- [ ] DR drill completed
