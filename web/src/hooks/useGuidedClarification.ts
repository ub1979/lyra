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
  answer_protocol?: unknown
}

/** Owns only the lifetime and PTY answer transport of a pending TUI question. */
export function useGuidedClarification(socketRef: { current: WebSocket | null }) {
  const [request, setRequest] = useState<GuidedClarificationRequest | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<GuidedClarificationRequest | null>(null)
  const submitted = useRef(false)
  const attempted = useRef<{ requestId: string; answer: string } | null>(null)
  useEffect(
    () => () => {
      pending.current = null
      if (retryTimer.current) clearTimeout(retryTimer.current)
    },
    []
  )

  const clear = useCallback(() => {
    pending.current = null
    submitted.current = false
    attempted.current = null
    setRequest(null)
    setSending(false)
    setError('')
    if (retryTimer.current) clearTimeout(retryTimer.current)
  }, [])

  const handleEvent = useCallback(
    (type: string, payload?: ClarificationEventPayload) => {
      if (type === 'clarify.request') {
        const next = readGuidedClarification(payload)
        if (next && next.requestId !== pending.current?.requestId) {
          pending.current = next
          submitted.current = false
          attempted.current = null
          setRequest(next)
          setSending(false)
          setError(next.answerProtocol === 'atomic-v1' ? '' : 'Restart Lyra and refresh Studio to safely answer this question with the updated interface.')
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
      if (!current || submitted.current) return false
      if (attempted.current?.requestId === current.requestId && attempted.current.answer !== text.trim()) {
        setError('Delivery is uncertain. Retry the same answer; you can send a correction once Lyra confirms it.')
        return false
      }
      if (current.answerProtocol !== 'atomic-v1') {
        setError('Restart Lyra and refresh Studio before answering. This chat is still using the older interface.')
        return false
      }
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setError('The connection is not ready. Reconnect, then send your answer again.')
        return false
      }
      const sent = answerGuidedClarification(current, text, {
        isOpen: () =>
          pending.current?.requestId === current.requestId &&
          socketRef.current === socket &&
          socket.readyState === WebSocket.OPEN,
        send: data => socket.send(data),
        schedule: (run, delayMs) => window.setTimeout(run, delayMs)
      })
      if (sent) {
        attempted.current = { requestId: current.requestId, answer: text.trim() }
        submitted.current = true
        setSending(true)
        setError('')
        if (retryTimer.current) clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => {
          if (pending.current?.requestId !== current.requestId) return
          submitted.current = false
          setSending(false)
          setError('Delivery has not been confirmed. Reconnect if needed, then send your answer again.')
        }, 12_000)
      } else {
        setError('Your answer was not sent. Check the connection and keep answers under 32,000 characters.')
      }
      return sent
    },
    [socketRef]
  )

  return { request, sending, error, handleEvent, answer, clear, pending }
}
