import { useCallback, useEffect, useRef, useState } from 'react'
import {
  answerGuidedClarification,
  readGuidedClarification,
  type GuidedClarificationRequest
} from '../lib/guided-clarification'

interface ClarificationEventPayload {
  request_id?: unknown
  question?: unknown
  choices?: unknown
  name?: unknown
}

/** Owns only the lifetime and PTY answer transport of a pending TUI question. */
export function useGuidedClarification(socketRef: { current: WebSocket | null }) {
  const [request, setRequest] = useState<GuidedClarificationRequest | null>(null)
  const [sending, setSending] = useState(false)
  const pending = useRef<GuidedClarificationRequest | null>(null)
  const submitted = useRef(false)
  useEffect(
    () => () => {
      pending.current = null
    },
    []
  )

  const clear = useCallback(() => {
    pending.current = null
    submitted.current = false
    setRequest(null)
    setSending(false)
  }, [])

  const handleEvent = useCallback(
    (type: string, payload?: ClarificationEventPayload) => {
      if (type === 'clarify.request') {
        const next = readGuidedClarification(payload)
        if (next && next.requestId !== pending.current?.requestId) {
          pending.current = next
          submitted.current = false
          setRequest(next)
          setSending(false)
        }
      } else if (
        (type === 'clarify.expire' && payload?.request_id === pending.current?.requestId) ||
        (type === 'tool.complete' && payload?.name === 'clarify') ||
        type === 'message.complete' ||
        type === 'error'
      ) {
        clear()
      }
    },
    [clear]
  )

  const answer = useCallback(
    (text: string): boolean => {
      const current = pending.current
      const socket = socketRef.current
      if (!current || submitted.current || !socket || socket.readyState !== WebSocket.OPEN) return false
      const sent = answerGuidedClarification(current, text, {
        isOpen: () =>
          pending.current?.requestId === current.requestId &&
          socketRef.current === socket &&
          socket.readyState === WebSocket.OPEN,
        send: data => socket.send(data),
        schedule: (run, delayMs) => window.setTimeout(run, delayMs)
      })
      if (sent) {
        submitted.current = true
        setSending(true)
      }
      return sent
    },
    [socketRef]
  )

  return { request, sending, handleEvent, answer, clear, pending }
}
