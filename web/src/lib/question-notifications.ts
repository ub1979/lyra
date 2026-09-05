/** Browser-only, opt-in alerts. No chat content is persisted or sent elsewhere. */
export interface QuestionAlert {
  id: string
  title: string
}

export class QuestionNotifications {
  private seen = new Set<string>()
  private storage: Pick<Storage, 'getItem' | 'setItem'> | undefined
  private key: string

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, key: string) {
    this.storage = storage
    this.key = key
    try {
      const saved: unknown = JSON.parse(storage?.getItem(key) ?? '[]')
      if (Array.isArray(saved))
        this.seen = new Set(saved.filter((id): id is string => typeof id === 'string').slice(-200))
    } catch {
      /* Restricted storage must not break the project chat. */
    }
  }

  deliver(
    alert: QuestionAlert,
    enabled: boolean,
    permission: string,
    send: (title: string, tag: string) => void
  ): boolean {
    if (!enabled || permission !== 'granted' || this.seen.has(alert.id)) return false
    try {
      send(alert.title, alert.id)
    } catch {
      return false
    }
    this.seen.add(alert.id)
    this.seen = new Set([...this.seen].slice(-200))
    try {
      this.storage?.setItem(this.key, JSON.stringify([...this.seen]))
    } catch {
      /* Best effort deduplication. */
    }
    return true
  }
}
