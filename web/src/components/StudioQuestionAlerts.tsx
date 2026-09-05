import { Bell, BellOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { UltimateBuilderRunState } from '../lib/api'
import type { GuidedClarificationRequest } from '../lib/guided-clarification'
import { QuestionNotifications } from '../lib/question-notifications'

interface StudioQuestionAlertsProps {
  workspace: string
  question: GuidedClarificationRequest | null
  runState: UltimateBuilderRunState | null
  stale: boolean
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/** Optional system alerts complement the existing question and worker cards. */
export function StudioQuestionAlerts({ workspace, question, runState, stale }: StudioQuestionAlertsProps) {
  const storage = safeStorage()
  const key = `lyra:question-alerts:${workspace}`
  const [enabled, setEnabled] = useState(() => {
    try {
      return storage?.getItem(key) === 'on'
    } catch {
      return false
    }
  })
  const [notice, setNotice] = useState('')
  const notifier = useMemo(() => new QuestionNotifications(storage, `${key}:seen`), [storage, key])
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    const alerts = question ? [{ id: question.requestId, title: 'Lyra needs your answer' }] : []
    if (!stale)
      for (const task of runState?.tasks ?? []) {
        if (task.status === 'blocked' && task.block_kind === 'needs_input' && !task.paused_by_user) {
          alerts.push({
            id: `${task.board}:${task.task_id}:${task.attention_id ?? task.last_activity_at}`,
            title: `${task.label} needs your answer`
          })
        }
      }
    for (const alert of alerts)
      notifier.deliver(alert, enabled, Notification.permission, (title, tag) => {
        // Omit the question itself from lock-screen notifications.
        const notification = new Notification(title, {
          tag,
          body: 'Open Lyra Studio to review the question and continue.'
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      })
  }, [enabled, notifier, question, runState, stale])

  const toggle = async () => {
    if (enabled) {
      setEnabled(false)
      try {
        storage?.setItem(key, 'off')
      } catch {
        /* Session-only preference. */
      }
      return
    }
    if (typeof Notification === 'undefined') {
      setNotice('This browser does not support computer alerts. Questions remain visible in Studio.')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotice('Alerts are not allowed. You can allow notifications in your browser settings.')
        return
      }
      setEnabled(true)
      setNotice('')
      try {
        storage?.setItem(key, 'on')
      } catch {
        /* Session-only preference. */
      }
    } catch {
      setNotice('Alerts could not be enabled. Your project can still continue normally.')
    }
  }
  return (
    <>
      <button
        type="button"
        className="lyra-studio-icon-control"
        aria-pressed={enabled}
        aria-label={enabled ? 'Turn question alerts off' : 'Turn question alerts on'}
        title={enabled ? 'Question alerts on' : 'Notify me when Lyra needs an answer'}
        onClick={() => void toggle()}
      >
        {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
      {notice && (
        <span role="status" className="max-w-xs whitespace-normal text-xs text-text-primary">
          {notice}
        </span>
      )}
    </>
  )
}
