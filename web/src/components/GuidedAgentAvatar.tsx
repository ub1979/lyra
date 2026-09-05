import { useState } from 'react'
import { cn } from '../lib/utils'

interface GuidedAgentAvatarProps {
  className: string
  id: string
  muted?: boolean
}

/** A single avatar renderer, with a fallback for unavailable local artwork. */
export function GuidedAgentAvatar({ className, id, muted = false }: GuidedAgentAvatarProps) {
  const [failed, setFailed] = useState(false)
  const label = id
  if (failed) {
    return (
      <span
        aria-hidden
        className={cn(className, 'grid place-items-center bg-midground/15 font-semibold text-midground')}
      >
        {label.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={`/skill-avatars/${id.replaceAll('_', '-')}${muted ? '-sad' : ''}.webp`}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
