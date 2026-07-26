---
name: benchmark
description: Performance benchmarking — measures Core Web Vitals, API latency, bundle size, and build time; compares against prior runs to catch regressions. Use when the user mentions: benchmark, performance test, lighthouse, core web vitals, bundle size, load time, latency, throughput, page speed.
---

# Performance Benchmark

Measures application performance across multiple dimensions and compares against previous benchmarks to detect regressions. Produces `.sdlc/benchmark-report.md`.

---

## ⛔ ENFORCEMENT: EVERY METRIC MUST COME FROM TOOL OUTPUT

> Do not estimate performance. Run the measurement tool, read the number, record it.
> "Should be fast" is not a benchmark. "`lighthouse --output json` reports LCP: 1.2s" is a benchmark.

---

## Step 1 — Detect Application Type

```bash
ls package.json requirements.txt go.mod 2>/dev/null
cat package.json 2>/dev/null | grep -E '"(next|react|vue|svelte|express|fastify)"'
ls src/app src/pages public index.html 2>/dev/null
```

Determine which benchmarks apply:

| App Type | Benchmarks |
|----------|-----------|
| Web App (SSR/SPA) | Core Web Vitals + Bundle Size + Build Time + API Latency |
| API Service | API Latency + Throughput + Build Time |
| CLI Tool | Execution Time + Build Time |
| Library | Build Time + Bundle Size |

---

## Step 2 — Load Previous Benchmark

```bash
cat .sdlc/benchmark-report.md 2>/dev/null
```

If a previous benchmark exists, extract all metric values for comparison. If none exists, this is a baseline run.

---

## Step 3 — Run Benchmarks

### 3.1 Build Performance

```bash
# Clean build
rm -rf dist/ build/ .next/ node_modules/.cache/ 2>/dev/null

# Timed build
time npm run build 2>&1

# Bundle analysis (if web app)
du -sh dist/ build/ .next/ 2>/dev/null
npx source-map-explorer dist/**/*.js --json 2>/dev/null | jq '.results[0].totalBytes'
# or: npx next-bundle-analyzer 2>/dev/null
```

Record: build time (seconds), output size (bytes), largest chunk.

### 3.2 Core Web Vitals (Web Apps Only)

**Requires the app to be running.** Start it first:

```bash
npm run build && npm start &
sleep 5
```

**Option A: Lighthouse CLI (preferred)**
```bash
npx lighthouse http://localhost:3000 --output json --chrome-flags="--headless --no-sandbox" 2>/dev/null
# Extract metrics:
# LCP (Largest Contentful Paint) — target: <2.5s
# FID/INP (Interaction to Next Paint) — target: <200ms
# CLS (Cumulative Layout Shift) — target: <0.1
# FCP (First Contentful Paint) — target: <1.8s
# TTI (Time to Interactive) — target: <3.8s
# TBT (Total Blocking Time) — target: <200ms
# Performance Score — target: >90
```

**Option B: Playwright Performance (fallback)**
```bash
npx playwright test --config=perf.config.ts 2>/dev/null
# or manually:
# Navigate to page, measure load timing via Performance API
```

Record all available metrics.

### 3.3 API Response Times

```bash
# Install k6 or use curl timing
# k6 (preferred for load testing)
cat > /tmp/bench-api.js <<'EOF'
import http from 'k6/http';
import { check } from 'k6';
export const options = {
  vus: 10,
  duration: '30s',
  thresholds: { http_req_duration: ['p(95)<200'] },
};
export default function () {
  const res = http.get('http://localhost:3000/api/health');
  check(res, { 'status 200': (r) => r.status === 200 });
}
EOF
k6 run /tmp/bench-api.js 2>/dev/null

# Fallback: curl timing (3 runs, report median)
for i in 1 2 3; do
  curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000/api/health
done
```

Record: p50, p95, p99 latency, throughput (req/s), error rate.

### 3.4 Startup Time

```bash
# Measure cold start
time (npm start &
  until curl -sf http://localhost:3000/health > /dev/null 2>&1; do sleep 0.1; done
  echo "Ready")
kill %1 2>/dev/null
```

Record: seconds from process start to first healthy response.

### 3.5 Memory & Resource Usage

```bash
# Start app, measure memory after stabilization
npm start &
APP_PID=$!
sleep 10
ps -o rss= -p $APP_PID | awk '{print $1/1024 "MB"}'
kill $APP_PID 2>/dev/null
```

Record: RSS memory in MB after 10s of idle.

---

## Step 4 — Compare & Flag Regressions

For each metric, compare against the previous benchmark:

| Delta | Verdict | Action |
|-------|---------|--------|
| Improved >10% | IMPROVED | Note in report |
| Within 10% | STABLE | No action |
| Degraded 10-25% | WARNING | Flag in report |
| Degraded >25% | REGRESSION | Flag as failure, recommend investigation |

---

## Step 5 — Write .sdlc/benchmark-report.md

```bash
mkdir -p .sdlc
```

```markdown
# Performance Benchmark Report

> Date: [date]
> Project: [name]
> App Type: [Web App / API / CLI / Library]
> Run Type: [Baseline / Comparison]

## Build Performance

| Metric | Current | Previous | Delta | Status |
|--------|---------|----------|-------|--------|
| Build Time | Xs | Xs | +/-X% | STABLE/WARNING/REGRESSION |
| Bundle Size | XMB | XMB | +/-X% | STABLE/WARNING/REGRESSION |
| Largest Chunk | XKB | XKB | +/-X% | STABLE/WARNING/REGRESSION |

## Core Web Vitals (if web app)

| Metric | Current | Target | Previous | Delta | Status |
|--------|---------|--------|----------|-------|--------|
| LCP | Xs | <2.5s | Xs | +/-X% | PASS/FAIL |
| INP | Xms | <200ms | Xms | +/-X% | PASS/FAIL |
| CLS | X | <0.1 | X | +/-X% | PASS/FAIL |
| FCP | Xs | <1.8s | Xs | +/-X% | PASS/FAIL |
| TTI | Xs | <3.8s | Xs | +/-X% | PASS/FAIL |
| TBT | Xms | <200ms | Xms | +/-X% | PASS/FAIL |
| Perf Score | X/100 | >90 | X/100 | +/-X | PASS/FAIL |

## API Response Times (if API)

| Endpoint | p50 | p95 | p99 | Throughput | Errors | Status |
|----------|-----|-----|-----|------------|--------|--------|
| GET /health | Xms | Xms | Xms | X req/s | X% | PASS/FAIL |
| [other endpoints] | ... | ... | ... | ... | ... | ... |

## Resource Usage

| Metric | Current | Previous | Delta | Status |
|--------|---------|----------|-------|--------|
| Startup Time | Xs | Xs | +/-X% | STABLE/WARNING/REGRESSION |
| Memory (idle) | XMB | XMB | +/-X% | STABLE/WARNING/REGRESSION |

## Regressions Found

| Metric | Previous | Current | Delta | Severity |
|--------|----------|---------|-------|----------|
| [metric] | X | Y | +Z% | WARNING/REGRESSION |

## Recommendations

- [Actionable performance improvement suggestion]

## Raw Evidence

<details>
<summary>Tool output</summary>

[Paste raw Lighthouse/k6/curl output here]

</details>
```

---

## Step 6 — Summary

Present a one-line summary:

> "Benchmark complete: [X] metrics measured, [Y] regressions, [Z] improvements. Perf score: [N]/100. Full report: `.sdlc/benchmark-report.md`."
