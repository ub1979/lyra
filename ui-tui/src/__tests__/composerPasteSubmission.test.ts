import { PassThrough } from 'node:stream'

import { renderSync } from '@hermes/ink'
import React, { useRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { patchUiState, resetUiState } from '../app/uiStore.js'
import { useComposerState } from '../app/useComposerState.js'
import { useSubmission } from '../app/useSubmission.js'
import type { GatewayClient } from '../gatewayClient.js'

afterEach(() => resetUiState())

it.each(
  [false, true].flatMap(busy => ['first', '!echo pasted', 'example {!echo pasted}'].map(first => ({ busy, first })))
)('retains literal paste before rerender ($busy, $first)', async ({ busy, first }) => {
  resetUiState()
  patchUiState({ sid: 'paste-session', busy, busyInputMode: 'queue' })
  const request = vi.fn(async (method: string) => (method === 'input.detect_drop' ? { matched: false } : {}))
  const gw = { request } as unknown as GatewayClient
  let exposed: { composer: ReturnType<typeof useComposerState>; submission: ReturnType<typeof useSubmission> }

  function Harness() {
    const submitRef = useRef<(text: string) => void>(() => {})
    const slashRef = useRef(() => false)
    const composer = useComposerState({ gw, submitRef, onClipboardPaste: () => {} })

    const submission = useSubmission({
      appendMessage: () => {},
      composerActions: composer.actions,
      composerRefs: composer.refs,
      composerState: composer.state,
      gw,
      setLastUserMsg: () => {},
      slashRef,
      submitRef,
      sys: () => {}
    })

    exposed = { composer, submission }

    return null
  }

  const streams = { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() }
  Object.assign(streams.stdout, { columns: 80, rows: 24, isTTY: false })
  Object.assign(streams.stdin, { isTTY: false })
  Object.assign(streams.stderr, { isTTY: false })
  streams.stdout.on('data', () => {})

  const instance = renderSync(React.createElement(Harness), {
    patchConsole: false,
    stdin: streams.stdin as NodeJS.ReadStream,
    stdout: streams.stdout as NodeJS.WriteStream,
    stderr: streams.stderr as NodeJS.WriteStream
  })

  try {
    const snapshot = exposed!
    const full = `${first}\nsecond\nthird\nfourth\nfifth\nlast`

    const pasted = await snapshot.composer.actions.handleTextPaste({
      text: full,
      value: '',
      cursor: 0,
      bracketed: true,
      hotkey: false
    })

    expect(pasted?.value).not.toBe(full)
    // TextInput holds the new label before the parent render publishes state.
    snapshot.submission.dispatchSubmission(pasted!.value)
    await Promise.resolve()
    await Promise.resolve()

    if (busy) {
      expect(snapshot.composer.refs.queueRef.current).toEqual([{ text: full }])
      patchUiState({ busy: false })
      snapshot.submission.sendQueued(snapshot.composer.actions.dequeue()!)
      await Promise.resolve()
      await Promise.resolve()
      expect(request).toHaveBeenCalledWith('prompt.submit', { session_id: 'paste-session', text: full })
    } else {
      expect(request).toHaveBeenCalledWith('prompt.submit', { session_id: 'paste-session', text: full })
    }

    expect(snapshot.composer.refs.historyRef.current).toContain(full)
    expect(snapshot.composer.refs.pasteSnipsRef.current).toEqual([])
    expect(request.mock.calls.some(([method]) => method === 'shell.exec')).toBe(false)
    // Explicit queue command syntax remains supported; pasted examples are not commands.
    snapshot.submission.sendQueued('!echo deliberate')
    expect(request).toHaveBeenCalledWith('shell.exec', { command: 'echo deliberate' })
  } finally {
    instance.unmount()
    instance.cleanup()
  }
})
