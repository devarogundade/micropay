import { AudioLines, Image, MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'
import type { Agent, AgentType } from '#/lib/agents-api'

export const AGENT_TYPE_META: Record<
  AgentType,
  { label: string; icon: ReactNode; hint: string }
> = {
  chat: {
    label: 'Chat',
    icon: <MessageSquareText className="size-5" />,
    hint: 'Conversational assistant grounded in your knowledge base.',
  },
  image: {
    label: 'Image Gen',
    icon: <Image className="size-5" />,
    hint: 'Generates images from a text prompt on your chosen model.',
  },
  audio: {
    label: 'Audio',
    icon: <AudioLines className="size-5" />,
    hint: 'Transcribes speech to text using your chosen model.',
  },
}

export function AgentTypeBadge({ type, className }: { type: AgentType; className?: string }) {
  const meta = AGENT_TYPE_META[type] ?? AGENT_TYPE_META.chat
  return (
    <Badge variant="secondary" className={cn('gap-1 font-normal', className)}>
      {meta.icon}
      {meta.label}
    </Badge>
  )
}

export function AgentAvatar({
  agent,
  className,
}: {
  agent: Pick<Agent, 'imageUrl' | 'name' | 'type'>
  className?: string
}) {
  const meta = AGENT_TYPE_META[agent.type] ?? AGENT_TYPE_META.chat
  if (agent.imageUrl) {
    return (
      <img
        src={agent.imageUrl}
        alt=""
        className={cn('size-10 shrink-0 rounded-xl object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-snow text-mist',
        className,
      )}
    >
      {meta.icon}
    </div>
  )
}