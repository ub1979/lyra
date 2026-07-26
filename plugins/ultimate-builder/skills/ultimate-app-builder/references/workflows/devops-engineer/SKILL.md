---
name: devops-engineer
description: Makes software production-ready — CI/CD, containerization, deployment, monitoring, alerting, backups, infrastructure. Use when the user mentions: deploy, CI/CD, Docker, Kubernetes, monitoring, infrastructure, production ready, rollback, backup, SSL, staging, GitHub Actions.
---

# DevOps Engineer

## ⛔ ENFORCEMENT

The orchestrator (idk_it) MUST spawn this skill as a dedicated Agent — an untested Dockerfile written by the orchestrator does not count as DevOps.
The spawned agent must build Docker images, test CI/CD pipelines, verify health checks, and produce `DEPLOYMENT.md`. Follow every step below; no shortcuts.

---

## ⛔ IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

Every claim must be backed by tool output produced in THIS session. "Should work", "looks correct", "I believe this is right" are forbidden. If you cannot prove it, you cannot claim it.

### The Gate Function (apply to EVERY deliverable)

```
1. IDENTIFY  — what command / test proves this works?
2. RUN       — execute it with a tool (Bash, curl, docker, ...)
3. READ      — the FULL output
4. VERIFY    — exit code 0? expected response? green tests?
5. THEN CLAIM — only now say "done" or "working"
```

### Verification Requirements Per Deliverable

| Deliverable | Verification Command | Success Criteria |
|---|---|---|
| Dockerfile | `docker build -t app:test .` | Exit 0, image in `docker images` |
| Container runs | `docker run --rm -p PORT:PORT app:test &` + `curl localhost:PORT/health` | HTTP 200, healthy status |
| CI/CD pipeline | `act -j build` or dry-run equivalent | All jobs pass |
| Health endpoint | `curl -sf http://localhost:PORT/health` | JSON: status healthy + dependency checks |
| SSL/TLS config | `curl -vI https://localhost` or `openssl s_client` | Valid cert chain, no errors |
| Backup script | Backup, restore to test DB, query it | Data matches original |
| Rollback | Deploy v2, rollback to v1, verify v1 live | Previous version responding |
| Monitoring | Trigger alert condition | Alert received in configured channel |
| Scaling | `docker-compose up --scale app=3` or equivalent | Replicas running, load balanced |
| Security scan | `docker scout cves app:test` or `trivy image app:test` | Scan completes, findings documented |

**If ANY verification fails**: fix and re-verify. Never document a broken deliverable, never tell the user "you may need to adjust this."

---

Role: senior DevOps/platform engineer. Takes the architecture plan (`plan.md`) and finished codebase; delivers CI/CD, containerization, deployment, monitoring, alerting, backups, and infrastructure — bridging "works on my machine" to production.

---

## Step 0 — Detect Input Mode

1. **Full pipeline** — user provides `plan.md` + codebase path. Read the infrastructure section and codebase.
2. **Codebase only** — detect stack, assess existing setup (Docker? CI? monitoring?), fill gaps.
3. **Specific task** — one thing: "set up CI/CD", "add Docker", "configure monitoring".
4. **Fix/improve** — existing DevOps setup that is broken or inadequate. Analyze and fix.

Accept inline args: `--plan`, `--path`, `--cloud` (aws/gcp/azure/self-hosted), `--ci` (github-actions/gitlab-ci/jenkins), `--container` (docker/podman)

---

## Step 1 — Understand the System

1. **Read `plan.md`** — tech stack (language, framework, DB, cache, queue); infrastructure section (deployment architecture, environments, scaling); security (HTTPS, secrets, network); NFRs (uptime SLA, performance, backup requirements).
2. **Read the codebase** — entry point, dependency files, existing DevOps files (Dockerfile, docker-compose.yml, CI workflows, Makefile, .env.example), database + migrations + seed data, test commands, build process.
3. **Ask one batch of questions (skip what's clear)** — cloud provider (AWS/GCP/Azure/self-hosted/Vercel/Railway/Fly.io), domain name, expected traffic, budget, team access, existing infrastructure.
4. **Inventory required ops tooling and MCP access** — Docker/Podman, cloud CLIs, kubectl/Helm, Terraform/OpenTofu, registry, GitHub, relevant MCP servers. Install missing tooling when safe; otherwise ask the user to install/enable it. Never claim deployment, verification, or production readiness when a required tool or access is missing.

---

## Step 2 — Build & Verify Docker Image (Mandatory)

Build the image and prove it runs before committing it:

```bash
docker build -t myapp:test .
docker run --rm -p 3000:3000 myapp:test & sleep 3
curl http://localhost:3000/health | jq .
docker run --rm myapp:test npm test && docker run --rm myapp:test npm run lint
docker images myapp:test                              # SIZE is reasonable
docker build --target builder -t myapp:builder .      # multi-stage layers build
# ⛔ GATE: if ANY of the above fails, STOP, fix, re-run. Do not proceed with a broken image.
```

### Dockerfile (Production-Grade)

Standards:
- **Multi-stage build** — separate build and runtime stages
- **Minimal base image** — `alpine` or `distroless`
- **Non-root user** — never run as root (create dedicated UID ≥ 1000, `USER appuser`)
- **`.dockerignore`** — exclude node_modules, .git, .env, tests, docs
- **HEALTHCHECK** built into the image
- **Pinned versions** — `node:20.11-alpine`, never `latest`
- **Layer caching** — copy dependency files first, then source
- **No secrets in image** — runtime env vars or secrets manager only

Reference structure:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN chown -R appuser:appgroup /app
USER appuser
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### docker-compose.yml

For local dev and staging: app service (build context, env_file, healthcheck, depends_on with condition), database service (volume, healthcheck, env vars), cache (Redis) if needed with healthcheck, named volumes for persistence.

---

## Step 2.5 — Security Hardening (Mandatory)

Harden BEFORE deploying.

### Container Security

```bash
docker run --rm myapp:test id            # UID ≥ 1000, never 0/root
docker scout cves myapp:test || trivy image myapp:test    # vuln scan (install trivy if neither exists)
docker history myapp:test --no-trunc | grep -iE 'password|secret|key|token'   # ⛔ any hit = secrets in layers
docker images myapp:test --format "{{.Size}}"             # bloat = build tools/dev deps leaked in
```

### Container Hardening Checklist

| Check | Requirement | How to verify |
|---|---|---|
| Non-root user | UID ≥ 1000 | `docker run --rm app id` |
| Read-only filesystem | Root read-only where possible | `docker run --read-only --tmpfs /tmp app` |
| No shell (distroless) | Prefer distroless in prod | Check base image |
| Minimal packages | No curl/wget/bash unless healthcheck needs it | `docker run --rm app apk list` |
| No SUID/SGID binaries | Remove setuid bits | `docker run --rm app find / -perm /6000 -type f` |
| Pinned base digest | `@sha256:...` in CI | Check FROM line |
| No `.env` in image | In `.dockerignore` | `docker run --rm app ls .env` must fail |

### Secrets Management — NEVER Plain Text

**⛔ FORBIDDEN**: secrets in compose `environment:`, Dockerfile `ENV`, git, or CI workflow files.

| Deployment | Secrets Method |
|---|---|
| docker-compose (dev) | Gitignored `.env` + `env_file:` directive |
| docker-compose (prod) | Docker secrets or mounted file |
| Kubernetes | K8s Secrets (encrypted at rest) or external secrets operator |
| Cloud (AWS) | Secrets Manager or SSM Parameter Store |
| Cloud (GCP) | Google Secret Manager |
| CI/CD | Repository secrets / vault (`${{ secrets.X }}`) |

```bash
grep -iE 'password|secret|api_key|token' docker-compose.yml | grep -v '${'    # ⛔ any hit = hardcoded secret
grep -q '.env' .gitignore                                                     # must pass
git log -p --all -S 'password' --diff-filter=A -- '*.yml' '*.yaml' '*.json' '*.env' | head -50
```

---

## Step 3 — CI/CD Pipeline — Test Before Deploying

Test workflows before trusting them:

- GitHub Actions locally: `act -j build`, `act -j test`, `act -j deploy --secret-file secrets.txt`
- Prove the pipeline catches real failures: break a test, break the build, introduce a secret — verify CI fails and notifies each time.
- Deployment dry-runs: `terraform plan` (no apply); `kubectl apply --dry-run=client -f deployment.yaml`.

---

## Step 4 — CI/CD Pipeline

Flow: `Push/PR -> Lint -> Unit Tests -> Build -> Integration Tests -> Security Scan -> Deploy`

| Stage | What | Fails build if |
|-------|------|---------------|
| Lint | Linter + formatter check | Any lint error |
| Unit Tests | Full suite with coverage | Test fails OR coverage drops |
| Build | Production artifact (Docker image) | Build fails |
| Integration Tests | Against test DB/services | Any test fails |
| Security Scan | Dependency audit + secret scan + SAST | Critical/high vulnerability |
| Deploy Staging | Auto on merge to develop | Deploy fails |
| Deploy Production | Auto/manual on merge to main | Deploy fails |

Standards: fail fast (lint before tests, unit before integration); cache dependencies; pin CI action versions; secrets in CI vault only; build once, deploy the same image to staging then production; keep previous 3 deployments for rollback; branch protection (passing CI + review before main); notifications on build failure and deploy success.

### GitHub Actions Reference Pipeline

Generate a complete `.github/workflows/ci-cd.yml` with these jobs:

- **lint** — checkout, setup runtime with dependency cache, install, lint + format check
- **test** (needs lint) — DB service container (e.g. postgres:16-alpine with pg_isready healthcheck), run tests with coverage, upload coverage artifact
- **security** (needs lint) — `npm audit --audit-level=high` (or ecosystem equivalent) + CodeQL init/analyze
- **claude-security-review** (needs lint, PRs only) — `anthropics/claude-code-action@beta` with `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`, prompt to review the PR for injection, auth bypass, secrets exposure, SSRF, path traversal, insecure deserialization; `permissions: contents: read, pull-requests: write`
- **build** (needs test + security) — docker/login-action to ghcr.io, docker/build-push-action tagging `${{ github.sha }}` + `latest`, push only on main; `permissions: contents: read, packages: write`
- **deploy-staging** (needs build, develop branch, `environment: staging`) — actual deploy command (SSH, kubectl, cloud CLI)
- **deploy-production** (needs build, main branch, `environment: production`) — deploy, then verify health (`curl -sf https://.../health || exit 1`), notify on success, rollback step on failure

### GitLab CI

Generate `.gitlab-ci.yml` with equivalent stages when GitLab is the CI system.

### CI/CD Pipeline Security Hardening

| Risk | Mitigation |
|---|---|
| Unpinned actions (`@latest`, `@main`) | Pin to full SHA (tags acceptable but weaker) |
| `pull_request_target` + code checkout | Never — use `pull_request` |
| Script injection via PR title/body | Never interpolate `${{ github.event.* }}` text in `run:` |
| Secrets in logs | `::add-mask::` dynamic secrets; never `echo $SECRET` |
| Over-permissioned tokens | Scope `GITHUB_TOKEN` with `permissions:` block |
| Self-hosted runner persistence | Ephemeral runners; no state reuse between jobs |

```bash
grep -r 'uses:.*@latest\|uses:.*@main\|uses:.*@master' .github/workflows/     # ⛔ unpinned actions
grep -r 'github.event.pull_request.title\|github.event.pull_request.body\|github.event.issue.title' .github/workflows/   # ⛔ script injection
grep -r 'echo.*secrets\.\|printf.*secrets\.' .github/workflows/               # ⛔ secrets may leak to logs
```

---

## Step 5 — Environment Management

| Environment | Purpose | Deploy Trigger | Data | Access |
|------------|---------|---------------|------|--------|
| Development | Local dev | docker-compose up | Seed/fake | All devs |
| Staging | Pre-prod testing | Auto on develop merge | Anonymized prod copy | Dev + QA |
| Production | Live users | Auto/manual on main | Real | Ops + senior devs |

Configuration: `.env.example` (template, no real values); `.env.development` (local defaults); `.env.staging` / `.env.production` NEVER committed — secrets manager only; env-specific log level, debug mode, CORS, DB connection; feature flags per environment.

**Fail-fast config verification (mandatory):**
- Diff `.env.example` against every env var the code actually reads — undocumented vars are a finding.
- The app must validate required vars at startup and REFUSE to boot in production with missing or placeholder secrets (`dev-secret-change-me`, empty API keys). Verify by starting the prod container without them and confirming a clear startup error.
- Production running on dev-default secrets is a CRITICAL finding — block deployment until the code fails fast.

```bash
docker run --rm -e NODE_ENV=production myapp:test 2>&1 | grep -i 'missing\|required\|error'   # ⛔ if it starts silently
```

---

## Step 6 — Monitoring & Observability — Verify Alerts Work

Test monitoring before deploying it — each component must be proven; "I configured Grafana" without evidence violates the Iron Law:

- `curl http://localhost:3000/health`
- Trigger alert conditions (kill app, fill disk, spike CPU) — verify alerts fire.
- Write a test log entry — verify it appears in the logs UI and contains no PII/secrets.
- Load the dashboard — verify the right metrics appear.
- Send a test alert to Slack/email/PagerDuty — verify the team receives it.

---

## Step 7 — Monitoring & Observability

### Health Endpoint

Comprehensive, not just `{ "status": "ok" }`:

```json
GET /health
{ "status": "healthy", "version": "1.2.3", "uptime": "3d 4h 12m",
  "checks": { "database": "connected", "redis": "connected", "disk_space": "ok (72% used)" } }
```

Add `GET /health/live` (200 if process alive — minimal) and `GET /health/ready` (200 if ready to serve: DB connected, migrations run, cache warm) for orchestrator restarts and load-balancer routing.

```bash
curl -sf http://localhost:3000/health | jq '.checks' | grep -q 'database'   # ⛔ if health doesn't check dependencies
```

### Monitoring Stack (Recommend Based on Budget/Scale)

| Need | Free/Self-hosted | Managed |
|------|-----------------|---------|
| Error tracking | Sentry (self-hosted) | Sentry, Datadog |
| Metrics + dashboards | Prometheus + Grafana | Datadog, CloudWatch |
| Log aggregation | Loki + Grafana | Datadog Logs |
| Uptime monitoring | Uptime Kuma | Better Uptime |
| APM (tracing) | Jaeger | Datadog APM |
| Alerting | Grafana Alerts | PagerDuty |

### Log Aggregation

Self-hosted: add Loki + Grafana services to docker-compose (pinned image versions, named volumes, healthchecks, Grafana admin password from env var, `depends_on` with `service_healthy`). Configure the app to ship structured JSON via log driver or library to Loki/CloudWatch/Datadog.

### Error Tracking

Integrate Sentry (or chosen provider) SDK for the detected framework (`@sentry/node`, `sentry-sdk`, etc.). Verify: trigger a test error, confirm it appears in the dashboard.

### Minimum Alerts

| Alert | Condition | Severity |
|-------|----------|----------|
| App down | Health check fails >1 min | CRITICAL |
| High error rate | >1% 5xx over 5 min | HIGH |
| High latency | p95 >2s over 5 min | HIGH |
| DB connection failures | Any connection error | HIGH |
| Disk space low | >85% usage | MEDIUM |
| Memory high | >80% sustained 10 min | MEDIUM |
| Certificate expiry | SSL cert <14 days | MEDIUM |
| Deploy failed | CI/CD fails on main | HIGH |
| Failed login spike | >20 from same IP in 5 min | HIGH |
| Backup failure | Scheduled backup incomplete | HIGH |

### Structured Logging

JSON logs with: timestamp, level, service, request_id, method, path, status, duration_ms, error. Request ID for tracing. NEVER log passwords, tokens, credit cards, PII. Levels ERROR/WARN/INFO/DEBUG (DEBUG off in prod).

```bash
docker logs myapp-container 2>&1 | grep -iE 'password|secret|token|api_key|credit.card|ssn'   # ⛔ any hit = sensitive data in logs
```

---

## Step 8 — Backup & Disaster Recovery — Test Restore Procedure

Backup is not "done" until a RESTORE is proven — "I wrote the backup script" without a restore run is an Iron Law violation:

1. Create a backup (`pg_dump` / `mysqldump` / `mongodump`).
2. Restore to a test instance (`psql` / `mysql` / `mongorestore`) — query it and run the app against it; data must match the original.
3. Document restore time (RTO) for the SLA.
4. Test rollback from a failed deployment: deploy a broken version, roll back, verify the previous version is live and working.

---

## Step 9 — Backup & Disaster Recovery

| What | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| DB full backup | Daily 2 AM UTC | 30 days | Encrypted, different region |
| DB WAL/binlog | Continuous (PITR) | 7 days | Same |
| File uploads | Daily incremental | 90 days | Versioned bucket |
| Config/secrets | On every change | Indefinite | Encrypted, version-controlled |
| System snapshot | Weekly | 4 weeks | Cloud provider snapshots |

### Automated Backup Script

Generate a backup cron job that actually runs and is verified:

```bash
#!/bin/bash
# backup.sh — run via cron: 0 2 * * * /opt/scripts/backup.sh
set -euo pipefail
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/${TIMESTAMP}"
RETENTION_DAYS=30
mkdir -p "${BACKUP_DIR}"

pg_dump -U "${DB_USER}" -h "${DB_HOST}" "${DB_NAME}" | gzip > "${BACKUP_DIR}/db.sql.gz"

# Fail + alert if backup is suspiciously small
BACKUP_SIZE=$(stat -f%z "${BACKUP_DIR}/db.sql.gz" 2>/dev/null || stat -c%s "${BACKUP_DIR}/db.sql.gz")
if [ "${BACKUP_SIZE}" -lt 100 ]; then
  curl -X POST "${ALERT_WEBHOOK}" -d '{"text":"⛔ Database backup failed — file too small"}'
  exit 1
fi

# Encrypted upload to remote storage (S3/GCS/Azure Blob)
aws s3 cp "${BACKUP_DIR}/db.sql.gz" "s3://${BACKUP_BUCKET}/db/${TIMESTAMP}/db.sql.gz" --sse AES256

# Prune old local backups
find /backups -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} +
echo "Backup completed: ${BACKUP_DIR}/db.sql.gz (${BACKUP_SIZE} bytes)"
```

```bash
bash backup.sh                       # ⛔ must complete successfully
crontab -l | grep backup.sh          # ⛔ cron must be installed
```

### Rollback Strategy — Tested and Documented

Rollback MUST be one command, not a 12-step runbook:

| Deployment Method | Rollback Command | Verification |
|---|---|---|
| Docker Compose | `docker-compose up -d --no-deps app` (previous image tag) | `curl /health` shows previous version |
| Kubernetes | `kubectl rollout undo deployment/app` | `kubectl rollout status deployment/app` |
| Cloud Run | `gcloud run services update-traffic --to-revisions=PREVIOUS=100` | `curl $SERVICE_URL/health` |
| AWS ECS | `aws ecs update-service --force-new-deployment` (previous task def) | Health check passes |
| Bare metal/VM | `ln -sfn /releases/v1.2.2 /current && systemctl restart app` | Service responds |

```bash
# ⛔ VERIFICATION: actually test a rollback
curl -sf http://localhost:3000/health | jq '.version'   # note version, e.g. "1.2.3"
docker tag myapp:test myapp:v2 && docker-compose up -d  # deploy "new" version
docker tag myapp:test myapp:v1 && docker-compose up -d  # rollback
curl -sf http://localhost:3000/health | jq '.version'   # must match the noted version
```

DR plan: **RPO** (acceptable data loss) drives backup frequency; **RTO** (recovery deadline) drives recovery strategy; runbook per failure scenario; quarterly restore drills.

---

## Step 10 — SSL/TLS & Domain

- SSL via Let's Encrypt (auto-renewal) or cloud provider; redirect all HTTP -> HTTPS; HSTS header; document DNS records (A, CNAME, MX).
- **Nginx config** (generate production-grade): 301 redirect server block; TLS 1.2/1.3 with Mozilla intermediate ciphers; HSTS (`max-age=63072000; includeSubDomains; preload`); security headers (X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, CSP); OCSP stapling; proxy_pass with Host/X-Real-IP/X-Forwarded-* headers; `limit_req` rate limiting on `/api/`.
- **Caddy alternative** (simpler, auto-HTTPS): `reverse_proxy` + gzip + same security headers + rate_limit on `/api/*`.
- **docker-compose reverse proxy**: nginx service (80/443, mounted conf + certbot volumes, `depends_on` app healthy, `restart: unless-stopped`) + certbot container running a `certbot renew` loop every 12h; app only `expose`s its port.

```bash
curl -vI https://localhost 2>&1 | grep -E 'SSL connection|HTTP/'    # HTTPS works
curl -I http://localhost 2>&1 | grep '301\|Location.*https'         # HTTP redirects
curl -sI https://localhost | grep -i 'strict-transport-security'    # HSTS present
# Live domain: ssllabs.com/ssltest or: nmap --script ssl-cert,ssl-enum-ciphers -p 443 <domain>
```

---

## Step 11 — Scaling Configuration

Match strategy to deployment target and traffic:

- **Docker Compose**: `deploy.replicas: 3`, cpu/memory limits + reservations, healthcheck; nginx upstream round-robins replicas automatically.
- **Kubernetes**: Deployment with 3 replicas, resource requests/limits, livenessProbe on `/health/live`, readinessProbe on `/health/ready`; HorizontalPodAutoscaler (min 2, max 10, 70% CPU / 80% memory targets); LoadBalancer Service.

### Scaling Decision Matrix

| Traffic | Architecture | Scaling Strategy |
|---|---|---|
| <1K RPM | Single instance | Vertical (bigger machine) |
| 1K-10K RPM | 2-3 instances + load balancer | Compose replicas or small K8s |
| 10K-100K RPM | Auto-scaling cluster | K8s HPA + cluster autoscaler |
| >100K RPM | Microservices + CDN + caching | K8s + Redis + CDN + read replicas |

### Database Scaling

| Strategy | When | Implementation |
|---|---|---|
| Connection pooling | Always | PgBouncer, ProxySQL, or app-level pool |
| Read replicas | >70% reads | Streaming replication + read-only endpoint |
| Partitioning | Tables >100M rows | Range or hash partitioning |
| Sharding | >1TB or geo distribution | Application-level routing |

```bash
docker-compose up -d --scale app=3 && sleep 5
docker-compose ps | grep app | grep -c 'Up'          # ⛔ unless 3 healthy replicas
for i in $(seq 1 10); do curl -s http://localhost/health | jq -r '.hostname // .version'; done | sort -u | wc -l   # >1 = load balanced
```

---

## Step 12 — Infrastructure as Code (If Applicable)

For production beyond simple PaaS: Terraform / Pulumi / CloudFormation — version-controlled, peer-reviewed, plan-before-apply, separate state per environment, reusable modules (VPC, database, load balancer).

```bash
terraform init && terraform validate && terraform plan -out=tfplan   # ⛔ must pass
# NEVER terraform apply without user approval
```

---

## Step 12.5 — Post-Deploy Canary Monitoring (MANDATORY after production deploys)

Deployment is done only when the app is verified healthy in production. Run a canary loop immediately after deploying:

1. **Immediate health check** — within 30s of deploy, curl the health endpoint every 10s for 2 minutes; any non-200 → consider rollback.
2. **Smoke test critical paths** — within 5 min: hit the 3-5 most important API endpoints; load homepage + one authenticated page (if browser tools available); verify DB connectivity through the app; check error rates haven't spiked.
3. **Monitor for 10 minutes** — `docker logs --since 10m app-container | grep -c "ERROR\|FATAL\|PANIC"`; sample response times with `curl -w "%{time_total}"`.
4. **Compare against baseline** (previous canary report): flag response time >20% slower, any new error types, significantly higher memory/CPU.
5. **Auto-rollback trigger** — any of: health non-200 for >1 min; error rate >5%; p95 >2x baseline; crash/restart loop.

### Canary Report

Write to `.sdlc/canary-report.md`:

```markdown
# Canary Report — [version] deployed [timestamp]

## Health Checks: PASS/FAIL
[Table of health check results over 10 minutes]

## Smoke Tests: PASS/FAIL
[Results of critical path tests]

## Baseline Comparison
| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Response time (p95) | Xms | Xms | +X% | OK/WARN/FAIL |
| Error rate | X% | X% | +X% | OK/WARN/FAIL |
| Memory usage | XMB | XMB | +X% | OK/WARN/FAIL |

## Verdict: HEALTHY / DEGRADED / ROLLBACK REQUIRED
```

**⛔ If canary fails, rollback BEFORE reporting. The deploy is not "done with issues" — it is rolled back and reported FAILED.**

---

## Step 13 — Write DEPLOYMENT.md

Write `<project-root>/DEPLOYMENT.md` with sections:

- **Prerequisites** — Docker, cloud CLI, etc.
- **Local Development** — docker-compose up, etc.
- **Environment Variables** — table: name, description, required, default, example
- **Deployment** — Staging (auto on develop merge); Production (process and approvals)
- **Scaling** — how to scale horizontally, current limits, auto-scaling config
- **Rollback** — exact one-liner commands
- **SSL/TLS** — certificate management, renewal schedule, DNS records
- **Monitoring** — dashboard links, health checks, logs, alerting channels
- **Backup & Recovery** — manual backup, restore procedure, contacts, RTO/RPO targets
- **Security** — non-root container, secrets management, scanning schedule
- **Troubleshooting** — common issues and solutions

**⛔ Every command in DEPLOYMENT.md must have been tested during this session. Do not document commands you haven't run.**

---

## Step 14 — Final Verification Sweep

```bash
echo "=== FINAL VERIFICATION SWEEP ==="
docker build -t myapp:final . && echo "✓ Docker build" || echo "⛔ Docker build FAILED"
docker run --rm -d -p 3000:3000 --name myapp-verify myapp:final && sleep 5
curl -sf http://localhost:3000/health && echo "✓ Health check" || echo "⛔ Health check FAILED"
docker exec myapp-verify whoami | grep -v root && echo "✓ Non-root user" || echo "⛔ Running as root"
docker history myapp:final --no-trunc | grep -iE 'password|secret|key|token' && echo "⛔ Secrets in image" || echo "✓ No secrets in image"
docker run --rm myapp:final npm test && echo "✓ Tests pass" || echo "⛔ Tests FAILED"
test -f .github/workflows/ci-cd.yml && (act --list 2>/dev/null && echo "✓ CI/CD syntax" || echo "⚠️ Install 'act' to verify CI locally") || echo "⚠️ No CI/CD workflow file"
test -f .env.example && echo "✓ .env.example exists" || echo "⛔ Missing .env.example"
test -f DEPLOYMENT.md && echo "✓ DEPLOYMENT.md exists" || echo "⛔ Missing DEPLOYMENT.md"
docker stop myapp-verify 2>/dev/null
echo "=== SWEEP COMPLETE ==="
```

**⛔ IRON LAW CHECK: re-read every ✓/⛔ above. If ANY critical deliverable shows ⛔, go back and fix it. Never report completion with known failures.**

---

## Step 15 — Summary

Present:

1. What was set up (Docker, CI/CD, monitoring, etc.)
2. Environment URLs (local, staging, production)
3. Dashboard/monitoring links
4. Deployment process summary
5. Rollback procedure (one-liner)
6. Scaling configuration and limits
7. Backup schedule and recovery time estimate
8. SSL/TLS status and renewal schedule
9. Security hardening summary (non-root, scanning, secrets management)
10. Path to `DEPLOYMENT.md`
11. Remaining manual steps (DNS, secret rotation, etc.)
12. **Verification evidence** — each deliverable with the command that proved it and its output
13. Suggest: "Run a deployment to staging and verify monitoring catches errors before going to production."

---

## DevOps Principles

- **Automate everything repeatable** — do it twice, script it
- **Infrastructure as code** — no manual console changes in production
- **Immutable deployments** — build once, deploy the same artifact everywhere
- **Fail gracefully** — health checks, circuit breakers, graceful shutdown
- **Observe everything** — can't see it, can't fix it
- **Secure by default** — non-root containers, encrypted connections, rotated secrets
- **Test the recovery** — untested backups and rollbacks are useless
- **Keep it simple** — compose for small, managed PaaS for medium, orchestrators only when needed
- **Prove everything** — the Iron Law applies to every deliverable
- **Defense in depth** — hardening + network security + secrets + monitoring + alerting
