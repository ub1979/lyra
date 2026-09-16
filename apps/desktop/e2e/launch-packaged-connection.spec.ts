/** Packaged first-run UI → real authenticated backend → mock model → saved chat. */
import { expect, test } from './test'
import {
  createSandbox, packagedBinaryExists, setupPackagedApp, writeEnvFile,
  writeMockProviderConfig, type PackagedAppFixture, type Sandbox,
} from './fixtures'
import { startMockServer, MOCK_REPLY, type MockServer } from './mock-server'
import { startStudioDashboard, type StudioDashboard } from '../e2e-studio/studio-dashboard'

let app: PackagedAppFixture | undefined
let backendHome: Sandbox | undefined
let model: MockServer | undefined
let backend: StudioDashboard | undefined

test.afterAll(async () => {
  await app?.cleanup()
  await backend?.close()
  await model?.close()
  backendHome?.cleanup()
})

test('first-run Connect authenticates, chats and restores the reply after reload', async () => {
  test.skip(!packagedBinaryExists(), 'Build the packaged app first (npm run pack).')
  test.setTimeout(150_000)
  backendHome = createSandbox('packaged-backend')
  model = await startMockServer()
  writeMockProviderConfig(backendHome.hermesHome, model.url)
  writeEnvFile(backendHome.hermesHome)
  backend = await startStudioDashboard(backendHome.hermesHome)
  const html = await (await fetch(backend.url)).text()
  const token = /window\.__IDRAK_IT_SESSION_TOKEN__="([^"]+)"/.exec(html)?.[1]
  if (!token) throw new Error('Isolated backend did not expose its loopback session token')

  app = await setupPackagedApp({ fakeBoot: false })
  const page = app.page
  await page.getByRole('button', { name: /Connect to existing Lyra/ }).click({ timeout: 30_000 })
  await page.getByPlaceholder('https://gateway.example.com/hermes').fill(backend.url)
  const tokenInput = page.getByPlaceholder('Paste session token')
  await tokenInput.fill('deliberately-wrong-test-token')
  const check = page.getByRole('button', { name: 'Test connection', exact: true })
  const apply = page.getByRole('button', { name: 'Apply and reconnect', exact: true })
  await expect(check).toBeEnabled()
  await check.click()
  // HTTP discovery is public; the authenticated WebSocket leg rejects this token.
  await expect(page.getByText(/live WebSocket.*connection failed/i).first()).toBeVisible()
  await expect(apply).toBeDisabled()

  await tokenInput.fill(token)
  await check.click()
  await expect(apply).toBeEnabled({ timeout: 20_000 })
  await apply.click()
  const composer = page.locator('[contenteditable="true"]').first()
  await expect(composer).toBeVisible({ timeout: 30_000 })
  await composer.click()
  await composer.type('Packaged connection journey: please reply.', { delay: 10 })
  await page.keyboard.press('Enter')
  const reply = page.getByRole('paragraph').filter({ hasText: MOCK_REPLY })
  await expect(reply).toBeVisible({ timeout: 60_000 })
  expect(model.receivedPrompts.some(prompt => prompt.includes('Packaged connection journey'))).toBe(true)
  const callsBeforeReload = model.receivedPrompts.length
  await page.reload()
  await expect(reply).toBeVisible({ timeout: 30_000 })
  expect(model.receivedPrompts.length).toBe(callsBeforeReload)
})
