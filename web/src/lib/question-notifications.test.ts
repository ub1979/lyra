import { describe, expect, it, vi } from 'vitest'
import { QuestionNotifications } from './question-notifications'

describe('opt-in question alerts', () => {
  it('requires permission and opt-in, deduplicates after reload, and isolates projects', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      }
    }
    const alerts = new QuestionNotifications(storage, 'project-a')
    const send = vi.fn()
    const question = { id: 'question-1', title: 'Lyra needs your answer' }
    expect(alerts.deliver(question, false, 'granted', send)).toBe(false)
    expect(alerts.deliver(question, true, 'denied', send)).toBe(false)
    expect(alerts.deliver(question, true, 'granted', send)).toBe(true)
    expect(new QuestionNotifications(storage, 'project-a').deliver(question, true, 'granted', send)).toBe(false)
    expect(new QuestionNotifications(storage, 'project-b').deliver(question, true, 'granted', send)).toBe(true)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('does not break chat when storage or the browser notification API fails', () => {
    const alerts = new QuestionNotifications(
      {
        getItem: () => {
          throw Error('blocked')
        },
        setItem: () => {
          throw Error('blocked')
        }
      },
      'a'
    )
    const question = { id: '1', title: 'Needs input' }
    expect(
      alerts.deliver(question, true, 'granted', () => {
        throw Error('denied')
      })
    ).toBe(false)
    expect(alerts.deliver(question, true, 'granted', () => {})).toBe(true)
  })
})
