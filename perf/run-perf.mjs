// Perf regression runner: fixed warmup + iterations per bench (see bench.mjs).
// Usage: node perf/run-perf.mjs [--write-baseline]
// Without --write-baseline, compares median ms/op vs perf/baseline.json:
// regression >10% = warn, >25% = block (exit 1). Improvement is reported as %.
import { performance } from 'node:perf_hooks'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'
import { benches } from './bench.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const baselinePath = join(here, 'baseline.json')
const writeBaseline = process.argv.includes('--write-baseline')

function stats (samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  return { medianMs: +median.toFixed(5), p95Ms: +p95.toFixed(5), meanMs: +mean.toFixed(5), opsPerSec: Math.round(1000 / median) }
}

async function measure (bench) {
  // Batch timing: individual timing of sub-microsecond ops is below timer
  // noise on a shared VM, so each sample times a batch and divides.
  const batch = Math.max(1, Math.floor(bench.iterations / 100))
  for (let i = 0; i < bench.warmup; i++) await bench.fn()
  const samples = []
  for (let done = 0; done < bench.iterations; done += batch) {
    const n = Math.min(batch, bench.iterations - done)
    const t0 = performance.now()
    for (let i = 0; i < n; i++) await bench.fn()
    samples.push((performance.now() - t0) / n)
  }
  return { name: bench.name, scope: bench.scope, warmup: bench.warmup, iterations: bench.iterations, ...stats(samples) }
}

const results = []
for (const bench of benches) results.push(await measure(bench))

let commit = 'unknown'
try { commit = execSync('git rev-parse HEAD', { cwd: join(here, '..') }).toString().trim() } catch {}

if (writeBaseline) {
  const baseline = {
    generatedAt: '2026-11-21',
    environment: { os: `${os.type()} ${os.release()}`, arch: os.arch(), node: process.version, cpus: os.cpus()[0]?.model ?? 'unknown' },
    commit,
    results
  }
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n')
  console.log(`baseline written: ${baselinePath} (commit ${commit})`)
  for (const r of results) console.log(`${r.name}: median ${r.medianMs} ms/op, p95 ${r.p95Ms} ms/op, ${r.opsPerSec} ops/s`)
  process.exit(0)
}

if (!existsSync(baselinePath)) { console.error('VERDICT: block — perf/baseline.json missing; run with --write-baseline first'); process.exit(1) }
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
console.log(`baseline: commit ${baseline.commit}, node ${baseline.environment.node}, generated ${baseline.generatedAt}`)
let verdict = 'pass'
for (const r of results) {
  const base = baseline.results.find(b => b.name === r.name)
  if (!base) { console.log(`${r.name}: no baseline entry — warn`); verdict = 'warn'; continue }
  const delta = ((r.medianMs - base.medianMs) / base.medianMs) * 100
  let level = 'pass'
  if (delta > 25) level = 'block'; else if (delta > 10) level = 'warn'
  if (level === 'block') verdict = 'block'; else if (level === 'warn' && verdict === 'pass') verdict = 'warn'
  console.log(`${r.name}: median ${r.medianMs} ms/op vs baseline ${base.medianMs} ms/op = ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% [${level}]`)
}
console.log(`VERDICT: ${verdict}`)
process.exit(verdict === 'block' ? 1 : 0)
