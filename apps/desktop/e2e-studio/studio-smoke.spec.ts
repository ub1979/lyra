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

import { expect, test } from '@playwright/test'

import { createSandbox, writeEnvFile, writeMockProviderConfig, type Sandbox } from '../e2e/fixtures'
import { startEchoModel, type EchoModel } from './echo-model'
import { startStudioDashboard, type StudioDashboard } from './studio-dashboard'

const FIRST = 'hello from the studio smoke'
const SECOND = 'second message, please keep the first reply'

let sandbox: Sandbox
let project: string
let echo: EchoModel
let dashboard: StudioDashboard

test.beforeAll(async () => {
  sandbox = createSandbox('studio-smoke')
  // Outside the Lyra checkout: the project API rejects workspaces inside it.
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-studio-smoke-project-'))
  echo = await startEchoModel()
  // Studio pins model.provider + model.default from this file, and the
  // ultimate-builder plugin is opt-in — without it there is no coordinator.
  writeMockProviderConfig(sandbox.hermesHome, echo.url, undefined, 'plugins:\n  enabled:\n    - ultimate-builder')
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
  // Studio sends a hidden welcome seed; its echoed reply is the first bubble.
  await expect(bubbles.filter({ hasText: 'Echo:' }).first()).toBeVisible({ timeout: 90_000 })
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
  expect(echo.prompts.some((p) => p.includes(SECOND))).toBe(true)

  // Runtime panel: two instances mount (mobile + desktop); scope to the aside.
  const panel = page.locator('aside[aria-label="Live agents and token usage"]')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Lyra available')).toBeVisible()
  const tokens = panel.locator('details').filter({ has: page.locator('summary', { hasText: 'Tokens' }) })
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
  await expect(bubbles.filter({ hasText: 'Echo:' })).toHaveCount(3) // welcome + two replies, restored
  expect(echo.prompts.length).toBe(promptsBeforeReload)
})
