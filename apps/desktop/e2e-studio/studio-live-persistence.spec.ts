/** Opt-in real-model check: first requirements question survives a restart.
 * Run only with LYRA_LIVE_PERSISTENCE=1; never consumes model usage in CI.
 * The model and endpoint match the recorded local Trial 4 configuration.
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from '@playwright/test'
import { createSandbox } from '../e2e/fixtures'
import { REPO_ROOT, startStudioDashboard, type StudioDashboard } from './studio-dashboard'

test('live requirements reply is durable and resumes after backend restart', async ({ page }, info) => {
  test.skip(process.env.LYRA_LIVE_PERSISTENCE !== '1', 'Opt-in local Ollama check')
  test.setTimeout(360_000)
  const sandbox = createSandbox('studio-live-persistence')
  const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-live-persistence-project-')))
  let dashboard: StudioDashboard | undefined
  fs.writeFileSync(path.join(sandbox.hermesHome, 'config.yaml'), `model:
  provider: ollama-local
  default: glm-5.3-flash:cloud
  base_url: http://127.0.0.1:11434/v1
providers:
  ollama-local:
    name: Ollama local test
    api: http://127.0.0.1:11434/v1
    transport: chat_completions
    models:
      - glm-5.3-flash:cloud
plugins:
  enabled:
    - ultimate-builder
`, 'utf8')
  const saved = () => JSON.parse(execFileSync('uv', [
    'run', '--active', '--no-sync', 'python', '-c',
    'import json,sqlite3,sys; c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); print(json.dumps(c.execute("select session_id,role,content from messages order by id").fetchall()))',
    path.join(sandbox.hermesHome, 'state.db'),
  ], { cwd: REPO_ROOT, encoding: 'utf8' })) as [string, string, string][]
  try {
    dashboard = await startStudioDashboard(sandbox.hermesHome)
    await page.goto(`${dashboard.url}/chat?guided=1&workspace=${encodeURIComponent(project)}`)
    const composer = page.getByLabel('Message Lyra')
    await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 120_000 })
    const sent = Date.now()
    await composer.fill('Make Pocket Tasks, a tiny personal task list: add, complete, filter and delete tasks; save locally. First ask me one requirements question, then wait for my answer. Do not start planning or building yet.')
    await composer.press('Enter')
    // A model may ask in ordinary text OR pause inside clarify. Do not count
    // the assistant's pre-tool introduction as a finished requirements turn.
    const agentLog = path.join(sandbox.hermesHome, 'logs', 'agent.log')
    const turnEnded = () => fs.existsSync(agentLog) && fs.readFileSync(agentLog, 'utf8').includes('Turn ended')
    await expect.poll(async () => {
      if (turnEnded()) return true
      return /Type your answer/.test(await composer.getAttribute('placeholder') ?? '')
    }, { timeout: 180_000, intervals: [1000] }).toBe(true)
    if (!turnEnded()) {
      await composer.fill('Personal one-off app. Keep simple defaults. Record that answer, then reply with a one-sentence summary and STOP for now. Do not plan, build or ask another question yet.')
      await composer.press('Enter')
    }
    await expect.poll(turnEnded, { timeout: 180_000, intervals: [1000] }).toBe(true)
    const replies = saved().filter(([, role, text]) => role === 'assistant' && text.trim())
    const [sessionId, , reply] = replies[replies.length - 1]
    const conversation = page.locator('.lyra-studio-conversation')
    await expect(conversation).toContainText(reply.slice(-80), { timeout: 30_000 })
    await info.attach('first-reply-timing', {
      body: JSON.stringify({ elapsedMs: Date.now() - sent, sessionId, replyCharacters: reply.length }),
      contentType: 'application/json',
    })
    await page.goto('about:blank')
    await dashboard.close()
    dashboard = await startStudioDashboard(sandbox.hermesHome)
    await page.goto(`${dashboard.url}/chat?guided=1&workspace=${encodeURIComponent(project)}&resume=${sessionId}`)
    await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 120_000 })
    await expect(conversation).toContainText(reply.slice(-80), { timeout: 60_000 })
    expect(saved().some(([sid, role, text]) => sid === sessionId && role === 'assistant' && text === reply)).toBe(true)
    await info.attach('resumed-ready', { body: await page.screenshot(), contentType: 'image/png' })
  } finally {
    await dashboard?.close()
    for (const name of ['agent.log', 'errors.log']) {
      const file = path.join(sandbox.hermesHome, 'logs', name)
      if (fs.existsSync(file)) await info.attach(name, { body: fs.readFileSync(file), contentType: 'text/plain' })
    }
    sandbox.cleanup()
    fs.rmSync(project, { recursive: true, force: true })
  }
})
