import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '#/lib/utils'

function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined
  const trimmed = href.trim()
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed
  return undefined
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const safe = safeHref(href)
    if (!safe) {
      return <span {...props}>{children}</span>
    }
    const external = /^https?:/i.test(safe)
    return (
      <a
        href={safe}
        {...props}
        {...(external
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
      >
        {children}
      </a>
    )
  },
}

export function MarkdownMessage({
  content,
  className,
  streaming = false,
  tone = 'assistant',
}: {
  content: string
  className?: string
  streaming?: boolean
  tone?: 'assistant' | 'user'
}) {
  return (
    <div
      className={cn(
        'markdown-message prose prose-sm max-w-none leading-relaxed',
        '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
        'prose-headings:scroll-mt-4 prose-headings:font-medium prose-headings:tracking-tight',
        'prose-h1:mb-2 prose-h1:mt-3 prose-h1:text-base',
        'prose-h2:mb-2 prose-h2:mt-3 prose-h2:text-[15px]',
        'prose-h3:mb-1.5 prose-h3:mt-2.5 prose-h3:text-sm',
        'prose-p:my-2 prose-p:leading-relaxed',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
        'prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:py-0.5 prose-blockquote:pl-3 prose-blockquote:italic',
        'prose-pre:my-2 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2 prose-pre:text-[12px]',
        'prose-code:rounded-sm prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none',
        'prose-a:underline prose-a:underline-offset-2',
        'prose-hr:my-3',
        'prose-strong:font-semibold',
        tone === 'assistant'
          ? [
              'prose-invert',
              'prose-headings:text-bone',
              'prose-p:text-mist',
              'prose-li:text-mist',
              'prose-strong:text-bone',
              'prose-em:text-mist',
              'prose-blockquote:border-smoke prose-blockquote:text-fog',
              'prose-code:bg-obsidian prose-code:text-bone',
              'prose-pre:bg-void prose-pre:text-mist prose-pre:shadow-[inset_0_0_0_1px_rgb(35,37,42)]',
              'prose-a:text-signal-teal hover:prose-a:text-mist',
              'prose-hr:border-graphite',
            ]
          : [
              'prose-headings:text-void',
              'prose-p:text-void',
              'prose-li:text-void',
              'prose-strong:text-void',
              'prose-em:text-void/90',
              'prose-blockquote:border-void/25 prose-blockquote:text-void/80',
              'prose-code:bg-void/10 prose-code:text-void',
              'prose-pre:bg-void/8 prose-pre:text-void',
              'prose-a:text-void hover:prose-a:opacity-80',
              'prose-hr:border-void/15',
            ],
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {streaming ? (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-middle" />
      ) : null}
    </div>
  )
}
