/**
 * Start the real Lyra dashboard for a browser test.
 *
 * Same shape as e2e/real-session-builder.ts (uv spawn, stdout readline,
 * stderr ring buffer, bounded wait) but for `hermes dashboard`, which prints
 * `IDRAK_IT_DASHBOARD_READY port=<n>` once bound. The dashboard spawns a node
 * terminal child per Studio chat, so shutdown signals the whole process group.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import * as path from 'node:path'
import * as readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { stripCredentials } from '../e2e/fixtures'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(HERE, '../../..')
const READY = /^IDRAK_IT_DASHBOARD_READY port=(\d+)\s*$/
const READY_TIMEOUT_MS = 90_000
const STDERR_RING = 80

export interface StudioDashboard {
  url: string
  port: number
  close: () => Promise<void>
  /** Last stderr lines, for attaching to a failed test. */
  stderrTail: () => string
}

export async function startStudioDashboard(hermesHome: string): Promise<StudioDashboard> {
  const env = {
    ...stripCredentials(process.env),
    HERMES_HOME: hermesHome,
    PYTHONPATH: REPO_ROOT,
    PYTHONUNBUFFERED: '1',
  }
  const child: ChildProcess = spawn(
    'uv',
    ['run', '--active', '--no-sync', 'python', '-m', 'hermes_cli.main', 'dashboard', '--port', '0', '--host', '127.0.0.1', '--no-open', '--skip-build'],
    { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  )
  const stderr: string[] = []
  readline.createInterface({ input: child.stderr! }).on('line', (line) => {
    stderr.push(line)
    if (stderr.length > STDERR_RING) stderr.shift()
  })
  const stderrTail = () => stderr.join('\n')

  const close = () =>
    new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.pid === undefined) {
        resolve()
        return
      }
      const group = -child.pid
      const finish = () => resolve()
      child.once('exit', finish)
      try {
        process.kill(group, 'SIGTERM')
      } catch {
        try {
          child.kill('SIGTERM')
        } catch {
          finish()
          return
        }
      }
      setTimeout(() => {
        try {
          process.kill(group, 'SIGKILL')
        } catch {
          // already gone
        }
        finish()
      }, 5_000).unref()
    })

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`dashboard did not report readiness within ${READY_TIMEOUT_MS} ms\n--- stderr ---\n${stderrTail()}`))
      void close()
    }, READY_TIMEOUT_MS)
    readline.createInterface({ input: child.stdout! }).on('line', (line) => {
      const match = READY.exec(line)
      if (match) {
        clearTimeout(timer)
        resolve(Number(match[1]))
      }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`dashboard exited with code ${code} before becoming ready\n--- stderr ---\n${stderrTail()}`))
    })
  })

  return { url: `http://127.0.0.1:${port}`, port, close, stderrTail }
}
