/**
 * A tiny OpenAI-compatible model that echoes the last user message.
 *
 * The Studio conversation drops a reply identical to the previous one by
 * design, so a fixed canned reply cannot prove that two turns leave two
 * bubbles. Echoing the prompt makes every reply distinct by construction. It
 * reports a `usage` object so the Tokens panel has something to show.
 */

import * as http from 'node:http'

export interface EchoModel {
  url: string
  port: number
  /** Last user message of every completion request, in order. */
  prompts: string[]
  close: () => Promise<void>
}

export const ECHO_MODEL_ID = 'mock-model'

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof (part as { text?: unknown })?.text === 'string' ? (part as { text: string }).text : ''))
      .join('')
  }
  return ''
}

/**
 * The most recent user-authored text. Lyra appends runtime notes as user-role
 * messages (`[System: The active model … changed]`), which are skipped, and
 * wraps the typed text in an `[[ IDRAK_INTERNAL_… ]]` directive block; the
 * echo keeps the tail of that block, where the typed text lives.
 */
function lastUserText(body: unknown): string {
  const messages = (body as { messages?: unknown[] })?.messages ?? []
  let fallback = ''
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as { role?: string; content?: unknown }
    if (message?.role !== 'user') continue
    const text = textOf(message.content).trim()
    if (!fallback) fallback = text
    if (text.startsWith('[System:')) continue
    return text
  }
  return fallback
}

function echoTail(text: string): string {
  const unwrapped = text.replace(/\s*\]\]\s*$/, '').trim()
  return unwrapped.length > 300 ? `…${unwrapped.slice(-300)}` : unwrapped
}

function usageFor(prompt: string, reply: string) {
  const promptTokens = Math.max(1, Math.ceil(prompt.length / 4))
  const completionTokens = Math.max(1, Math.ceil(reply.length / 4))
  return { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
}

function readJson(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => (raw += chunk))
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

export function startEchoModel(): Promise<EchoModel> {
  const prompts: string[] = []
  const server = http.createServer(async (request, response) => {
    const url = request.url ?? ''
    if (request.method === 'GET' && url.startsWith('/v1/models')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ object: 'list', data: [{ id: ECHO_MODEL_ID, object: 'model', owned_by: 'e2e' }] }))
      return
    }
    if (request.method === 'POST' && url.startsWith('/v1/chat/completions')) {
      const body = (await readJson(request)) as { stream?: boolean }
      const prompt = lastUserText(body)
      prompts.push(prompt)
      const reply = `Echo: ${echoTail(prompt)}`
      const id = `chatcmpl-echo-${prompts.length}`
      const created = Math.floor(Date.now() / 1000)
      const usage = usageFor(prompt, reply)
      if (body.stream) {
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        const chunk = (delta: Record<string, unknown>, finish: string | null, extra: Record<string, unknown> = {}) =>
          `data: ${JSON.stringify({
            id,
            object: 'chat.completion.chunk',
            created,
            model: ECHO_MODEL_ID,
            choices: [{ index: 0, delta, finish_reason: finish }],
            ...extra,
          })}\n\n`
        response.write(chunk({ role: 'assistant', content: '' }, null))
        for (const word of reply.split(/(?<=\s)/)) response.write(chunk({ content: word }, null))
        response.write(chunk({}, 'stop', { usage }))
        response.end('data: [DONE]\n\n')
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          id,
          object: 'chat.completion',
          created,
          model: ECHO_MODEL_ID,
          choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
          usage,
        }),
      )
      return
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { message: `no route for ${request.method} ${url}` } }))
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('echo model did not bind a TCP port'))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        port: address.port,
        prompts,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}
