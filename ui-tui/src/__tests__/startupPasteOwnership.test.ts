import { PassThrough } from 'node:stream'

import { renderSync } from '@hermes/ink'
import React, { useRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import type { GatewayRpc } from '../app/interfaces.js'
import { patchUiState, resetUiState } from '../app/uiStore.js'
import { useComposerState } from '../app/useComposerState.js'
import { useSessionLifecycle } from '../app/useSessionLifecycle.js'
import { useSubmission } from '../app/useSubmission.js'
import type { GatewayClient } from '../gatewayClient.js'

afterEach(() => resetUiState())

it.each([null, 'previous-session'])('handles pending paste across session creation from %s', async previous => {
  resetUiState()
  patchUiState({ sid: previous })
  let finishCreate!: (result: object) => void
  const created = new Promise<object>(resolve => {
    finishCreate = resolve
  })

  const request = vi.fn(async (method: string) => {
    if (method === 'session.create') {
      return created
    }

    if (method === 'input.detect_drop') {
      return { matched: false }
    }

    return {}
  })

  const gw = { request } as unknown as GatewayClient

  let exposed!: {
    composer: ReturnType<typeof useComposerState>
    lifecycle: ReturnType<typeof useSessionLifecycle>
    submission: ReturnType<typeof useSubmission>
  }

  const noop = () => {}

  function Harness() {
    const submitRef = useRef<(text: string) => void>(noop)
    const slashRef = useRef(() => false)
    const composer = useComposerState({ gw, submitRef, onClipboardPaste: noop })

    const lifecycle = useSessionLifecycle({
      colsRef: { current: 80 },
      composerActions: composer.actions,
      gw,
      panel: noop,
      rpc: request as GatewayRpc,
      scrollRef: { current: null },
      setHistoryItems: noop,
      setLastUserMsg: noop,
      setSessionStartedAt: noop,
      setStickyPrompt: noop,
      setVoiceProcessing: noop,
      setVoiceRecording: noop,
      sys: noop
    })

    const submission = useSubmission({
      appendMessage: noop,
      composerActions: composer.actions,
      composerRefs: composer.refs,
      composerState: composer.state,
      gw,
      setLastUserMsg: noop,
      slashRef,
      submitRef,
      sys: noop
    })

    exposed = { composer, lifecycle, submission }

    return null
  }

  const streams = { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() }
  Object.assign(streams.stdout, { columns: 80, rows: 24, isTTY: false })
  Object.assign(streams.stdin, { isTTY: false })
  Object.assign(streams.stderr, { isTTY: false })
  streams.stdout.on('data', noop)

  const instance = renderSync(React.createElement(Harness), {
    patchConsole: false,
    stdin: streams.stdin as NodeJS.ReadStream,
    stdout: streams.stdout as NodeJS.WriteStream,
    stderr: streams.stderr as NodeJS.WriteStream
  })

  try {
    const snapshot = exposed
    const starting = snapshot.lifecycle.newSession()
    await Promise.resolve()
    await Promise.resolve()
    const full = 'Requirements\nfirst\nsecond\nthird\nfourth\nlast'

    const pasted = await snapshot.composer.actions.handleTextPaste({
      text: full,
      value: '',
      cursor: 0,
      bracketed: true,
      hotkey: false
    })

    expect(snapshot.composer.refs.pasteSnipsRef.current).toHaveLength(1)
    // Reproduce the real race: RPC finishes after paste but before Enter.
    finishCreate({ session_id: 'new-session' })
    await starting

    if (previous) {
      // A genuine switch must not carry another conversation's paste metadata.
      expect(snapshot.composer.refs.pasteSnipsRef.current).toEqual([])
    } else {
      snapshot.submission.dispatchSubmission(pasted!.value)
      await Promise.resolve()
      await Promise.resolve()
      expect(request).toHaveBeenCalledWith('prompt.submit', { session_id: 'new-session', text: full })
    }
  } finally {
    instance.unmount()
    instance.cleanup()
  }
})
