import { Button } from '@nous-research/ui/ui/components/button'
import type { GuidedApprovalChoice } from '../lib/guided-agent-routing'

interface GuidedApprovalActionsProps {
  choices: readonly GuidedApprovalChoice[]
  command: string
  labels: Record<GuidedApprovalChoice, string>
  onChoose: (choice: GuidedApprovalChoice) => void
}

/** Approval controls attached to Lyra's message; technical detail stays optional. */
export function GuidedApprovalActions({ choices, command, labels, onChoose }: GuidedApprovalActionsProps) {
  return (
    <div aria-label="Approval choices" className="mt-3 border-t border-current/10 pt-3">
      {command && (
        <details className="mb-3 rounded-xl border border-current/15 bg-background-base/60 px-3 py-2 text-xs">
          <summary className="cursor-pointer text-text-secondary">View action details</summary>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-text-secondary">
            {command}
          </pre>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map(choice => (
          <Button key={choice} size="sm" outlined={choice !== 'once'} onClick={() => onChoose(choice)}>
            {labels[choice]}
          </Button>
        ))}
      </div>
    </div>
  )
}
