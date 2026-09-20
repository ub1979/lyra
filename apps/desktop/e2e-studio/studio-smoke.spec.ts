/**
 * Studio smoke: the only test that sees ChatPage's wiring.
 *
 * Real dashboard, real node terminal child, real gateway, headless Chromium;
 * only the model is a mock that echoes the prompt. It proves the user path
 * end to end — type, send, see the reply, send again and keep the first
 * reply — and that the Tokens panel reports. It cannot make a background job
 * complete, so notification turns stay covered by the reducer's frame replay.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { createSandbox, writeEnvFile, writeMockProviderConfig, type Sandbox } from '../e2e/fixtures'
import { startEchoModel, type EchoModel } from './echo-model'
import { REPO_ROOT, startStudioDashboard, type StudioDashboard } from './studio-dashboard'

const FIRST = 'hello from the studio smoke'
const SECOND = 'second message, please keep the first reply'

let sandbox: Sandbox
let project: string
let echo: EchoModel
let dashboard: StudioDashboard

test.beforeAll(async () => {
  sandbox = createSandbox('studio-smoke')
  // Outside the Lyra checkout: the project API rejects workspaces inside it.
  project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-studio-smoke-project-')))
  echo = await startEchoModel()
  // Studio pins model.provider + model.default from this file, and the
  // ultimate-builder plugin is opt-in — without it there is no coordinator.
  // Count conversation requests, not the independent background title request.
  writeMockProviderConfig(sandbox.hermesHome, echo.url, undefined,
    'plugins:\n  enabled:\n    - ultimate-builder\nauxiliary:\n  title_generation:\n    enabled: false')
  writeEnvFile(sandbox.hermesHome)
  dashboard = await startStudioDashboard(sandbox.hermesHome)
})

test.afterAll(async () => {
  await dashboard?.close()
  await echo?.close()
  sandbox?.cleanup()
  if (project) fs.rmSync(project, { recursive: true, force: true })
})

test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus && dashboard) {
    await info.attach('dashboard-stderr', { body: dashboard.stderrTail(), contentType: 'text/plain' })
    await info.attach('echo-prompts', { body: echo.prompts.join('\n---\n'), contentType: 'text/plain' })
  }
})

test('a user turn, a second turn, and the token panel all render in Studio', async ({ page }) => {
  await page.goto(`${dashboard.url}/chat?guided=1&workspace=${encodeURIComponent(project)}`)

  const composer = page.getByLabel('Message Lyra')
  const send = page.getByRole('button', { name: 'Send message' })
  const bubbles = page.locator('.lyra-studio-conversation .lyra-studio-message:not([role="status"])')

  // The composer's placeholder flips from "Preparing…" once the terminal child
  // and agent are ready; the send button additionally needs text, so it is
  // checked only after typing.
  await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 120_000 })
  // Opening an empty chat must not secretly submit a model turn. The real
  // provider records requests, so this tests the entire PTY/gateway boundary.
  expect(echo.prompts).toHaveLength(0)
  await expect(page.getByRole('status').filter({ hasText: 'Lyra is working' })).toBeHidden({ timeout: 60_000 })

  await composer.fill(FIRST)
  await expect(send).toBeEnabled({ timeout: 30_000 })
  await composer.press('Enter')
  // The typed text reaches the model inside Lyra's directive block, so the echo
  // contains it rather than equalling it.
  const firstReply = bubbles.filter({ hasText: 'Echo:' }).filter({ hasText: FIRST })
  await expect(bubbles.filter({ hasText: FIRST }).filter({ hasText: 'You' })).toBeVisible()
  await expect(firstReply).toHaveCount(1, { timeout: 60_000 })

  await expect(page.getByRole('status').filter({ hasText: 'Lyra is working' })).toBeHidden({ timeout: 60_000 })
  await composer.fill(SECOND)
  await expect(send).toBeEnabled({ timeout: 30_000 })
  await composer.press('Enter')
  const secondReply = bubbles.filter({ hasText: 'Echo:' }).filter({ hasText: SECOND })
  await expect(secondReply).toHaveCount(1, { timeout: 60_000 })
  // The regression the browser used to show: a new turn must not replace the last reply.
  await expect(firstReply).toHaveCount(1)
  expect(echo.prompts.some((p) => p.includes(FIRST))).toBe(true)
  expect(echo.prompts.find((p) => p.includes(FIRST))).toContain('IDRAK_INTERNAL_SETUP_BEGIN')
  expect(echo.prompts.some((p) => p.includes(SECOND))).toBe(true)

  // Runtime panel: two instances mount (mobile + desktop); scope to the aside.
  const panel = page.locator('aside[aria-label="Live agents and token usage"]')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Lyra ready', { exact: true })).toBeVisible()
  const tokens = panel.locator('details').filter({ has: page.locator('summary', { hasText: /tokens/i }) })
  await tokens.locator('summary').click()
  await expect(tokens.locator('summary strong')).not.toHaveText('Not reported yet', { timeout: 30_000 })
  await expect(tokens.getByText('Updated')).toBeVisible()

  // Cold resume: reload the same URL. Studio reopens the saved session, so the
  // whole exchange must come back from history — including Lyra's first
  // reply, which 0.19.49 stopped losing — and no new welcome seed may be sent
  // (a fresh session would show up as one more model call).
  const promptsBeforeReload = echo.prompts.length
  await page.reload()
  await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 120_000 })
  await expect(bubbles.filter({ hasText: FIRST }).filter({ hasText: 'You' })).toBeVisible({ timeout: 60_000 })
  await expect(firstReply).toHaveCount(1, { timeout: 60_000 })
  await expect(secondReply).toHaveCount(1)
  await expect(bubbles.filter({ hasText: 'Echo:' })).toHaveCount(2) // only actual user turns
  expect(echo.prompts.length).toBe(promptsBeforeReload)

  // A browser reload can reuse a live PTY child. Prove durability separately:
  // read SQLite using a new process, then restart the entire test dashboard.
  const savedMessages = () => JSON.parse(execFileSync('uv', [
    'run', '--active', '--no-sync', 'python', '-c',
    'import json,sqlite3,sys; c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); print(json.dumps(c.execute("select role,content from messages order by id").fetchall()))',
    path.join(sandbox.hermesHome, 'state.db'),
  ], { cwd: REPO_ROOT, encoding: 'utf8' })) as [string, string][]
  await expect.poll(() => savedMessages().filter(([role, content]) =>
    role === 'assistant' && content.startsWith('Echo:')).length).toBe(2)

  const previousUrl = new URL(page.url())
  const savedSessionId = await page.evaluate((workspace) =>
    localStorage.getItem(`idrak-it.guided-session.v1:${workspace}`), project)
  expect(savedSessionId).toBeTruthy()
  previousUrl.searchParams.set('resume', savedSessionId!)
  await page.goto('about:blank')
  await dashboard.close()
  dashboard = await startStudioDashboard(sandbox.hermesHome)
  // The ephemeral test port changed. localStorage is origin-bound; carry only the existing session/workspace
  // URL, not the old page's in-memory transcript, into the new server origin.
  await page.goto(`${dashboard.url}${previousUrl.pathname}${previousUrl.search}`)
  await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 120_000 })
  // A fresh origin intentionally restores the latest reply only; older
  // bubbles live in the history view/browser cache. Both must remain in DB.
  await expect(secondReply).toHaveCount(1, { timeout: 60_000 })
  expect(echo.prompts.length).toBe(promptsBeforeReload)
  expect(savedMessages().filter(([role, content]) => role === 'assistant' && content.startsWith('Echo:'))).toHaveLength(2)
})

test('New Project submits its brief once without reconnecting between paste and Enter', async ({ page }) => {
  const brief = 'Acknowledge the startup lifecycle probe. Do not create code or jobs.'
  const baseline = echo.prompts.length
  const frames: Array<{ socket: number; text: string }> = []
  let sockets = 0
  page.on('websocket', socket => {
    if (!socket.url().includes('/api/pty')) return
    const id = sockets++
    socket.on('framesent', frame => frames.push({ socket: id, text: String(frame.payload) }))
  })
  await page.goto(`${dashboard.url}/ultimate-builder`)
  await page.getByRole('button', { name: /Fast first version/ }).click()
  await page.getByRole('button', { name: 'Browse', exact: true }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Folder path').fill(project)
  await picker.getByRole('button', { name: 'Go', exact: true }).click()
  await expect(picker.getByText(project, { exact: true })).toBeVisible()
  await picker.getByRole('button', { name: 'Choose this folder', exact: true }).click()
  await page.getByPlaceholder('My new app', { exact: true }).fill('Startup probe')
  await page.locator('textarea').fill(brief)
  await page.getByRole('button', { name: 'Enter project studio →', exact: true }).click()

  // No composer fill, forced Enter, manual recovery or second submission.
  await expect.poll(() => echo.prompts.length, { timeout: 30_000 }).toBe(baseline + 1)
  const prompt = echo.prompts[baseline]
  expect(prompt.split(brief)).toHaveLength(2)
  expect(prompt.match(/IDRAK_INTERNAL_SETUP_BEGIN/g)).toHaveLength(1)
  expect(prompt).toContain('"team_selection_mode":"manual"')
  const paste = frames.find(frame => frame.text.startsWith('\x1b[200~'))!
  expect(paste).toBeTruthy()
  expect(frames.some(frame => frame.socket === paste.socket && frame.text === '\r')).toBe(true)
  const replies = page.locator('.lyra-studio-message').filter({ hasText: 'Echo:' })
  await expect(replies).toHaveCount(1, { timeout: 30_000 })

  await page.reload()
  const composer = page.getByLabel('Message Lyra')
  await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 60_000 })
  await expect(replies).toHaveCount(1)
  expect(echo.prompts).toHaveLength(baseline + 1)
  await composer.fill('Follow-up after startup reload')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(replies).toHaveCount(2, { timeout: 30_000 })
  expect(echo.prompts).toHaveLength(baseline + 2)
  expect(echo.prompts[baseline + 1]).not.toContain(brief)
  expect(echo.prompts[baseline + 1]).toContain('Do not recommend another team')
})

for (const customize of [false, true]) {
  test(`empty guided launch greets without inference and retains ${customize ? 'custom' : 'guided'} selection`, async ({ page }) => {
    const baseline = echo.prompts.length
    await page.goto(`${dashboard.url}/ultimate-builder`)
    await page.getByRole('button', { name: /Let Lyra guide me/ }).click()
    await page.getByRole('button', { name: 'Browse', exact: true }).click()
    const picker = page.getByRole('dialog')
    await picker.getByLabel('Folder path').fill(project)
    await picker.getByRole('button', { name: 'Go', exact: true }).click()
    await expect(picker.getByText(project, { exact: true })).toBeVisible()
    await picker.getByRole('button', { name: 'Choose this folder', exact: true }).click()
    await page.getByPlaceholder('My new app', { exact: true }).fill(customize ? 'Custom selection' : 'Guided selection')
    await page.getByRole('radio', { name: /Personal/ }).click()
    if (customize) {
      await page.getByRole('button', { name: 'Customize team', exact: true }).click()
      await page.locator('label.ub-skill').filter({ hasText: 'Development' }).click()
    }
    await page.getByRole('button', { name: 'Enter project studio →', exact: true }).click()
    await expect(page.getByText('whats the great idea you wanna build', { exact: true })).toBeVisible()
    const composer = page.getByLabel('Message Lyra')
    await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 60_000 })
    expect(echo.prompts).toHaveLength(baseline)
    await page.reload()
    await expect(composer).toHaveAttribute('placeholder', /Describe your idea/, { timeout: 60_000 })
    await expect(page.getByText('whats the great idea you wanna build', { exact: true })).toBeVisible()
    expect(echo.prompts).toHaveLength(baseline)
    await composer.fill('I want a tiny counter. Please acknowledge my chosen team.')
    await page.getByRole('button', { name: 'Send message', exact: true }).click()
    await expect.poll(() => echo.prompts.length, { timeout: 30_000 }).toBe(baseline + 1)
    const prompt = echo.prompts[baseline]
    expect(prompt).toContain(`"team_selection_mode":"${customize ? 'manual' : 'guided'}"`)
    expect(prompt).toContain(customize ? 'Do not recommend another team' : 'The user chose Let Lyra guide me')
    if (customize) expect(prompt).toContain('"enabled_specialists":["req-engineer","sw-developer"]')
    await expect(page.locator('.lyra-studio-message').filter({ hasText: 'Echo:' })).toHaveCount(1, { timeout: 30_000 })
    if (customize) {
      // Only the project activity response is controlled here. The timer sends
      // through the real composer, PTY, gateway and echo-provider transport.
      await page.route('**/api/plugins/ultimate-builder/state*', async route => {
        const response = await route.fetch()
        const body = await response.json()
        body.run_state = { ...body.run_state, active: true, state: 'working' }
        await route.fulfill({ response, json: body })
      })
      await page.waitForResponse(response => response.url().includes('/api/plugins/ultimate-builder/state'))
      await page.waitForFunction(() => {
        const workspace = new URL(location.href).searchParams.get('workspace')!
        return localStorage.getItem(`idrak-it.guided-progress-check.v1:${workspace}`) !== null
      })
      await page.evaluate(() => {
        const workspace = new URL(location.href).searchParams.get('workspace')!
        localStorage.setItem(`idrak-it.guided-progress-check.v1:${workspace}`, String(Date.now() - 1))
      })
      await expect.poll(() => echo.prompts.length, { timeout: 20_000 }).toBe(baseline + 2)
      await expect(page.locator('.lyra-studio-message').filter({ hasText: 'Update me (automatic five-minute check-in)' })).toBeVisible()
      expect(echo.prompts[baseline + 1]).toContain('Check existing project status only; do not start, retry, change, or approve work.')
    }
  })
}
