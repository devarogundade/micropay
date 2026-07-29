import { createFileRoute } from '@tanstack/react-router'

import { IdeApp } from '#/IdeApp'

export const Route = createFileRoute('/')({
  component: IdeApp,
  head: () => ({
    meta: [
      { title: 'IDE · Micropay' },
      {
        name: 'description',
        content:
          'AI-assisted Algorand TypeScript IDE — edit, compile, chat, and deploy.',
      },
    ],
  }),
})
