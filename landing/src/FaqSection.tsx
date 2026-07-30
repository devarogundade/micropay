import { useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

const FAQS = [
  {
    q: 'Do I need an API key?',
    a: 'No. Connect an Algorand wallet, pick a model, and pay per call in USDC via x402. No vendor accounts or monthly keys.',
  },
  {
    q: 'What wallets work?',
    a: 'Pera, Defly, Lute, and Kibisis. Any Algorand wallet that can sign x402 payment challenges.',
  },
  {
    q: 'How much does a call cost?',
    a: 'Pricing is shown before you run. Lite chat can start around $0.01 USDC; heavier models cost a bit more — always usage-priced.',
  },
  {
    q: 'Is there a subscription?',
    a: 'No seats and no retainers. You approve each settlement, then you are done until the next call.',
  },
  {
    q: 'What about agents and MCP?',
    a: 'Point Cursor or Claude Desktop at Micropay MCP for discovery and free tools. Paid inference still settles over wallet-paid HTTP APIs.',
  },
] as const

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)
  const baseId = useId()

  return (
    <section className="v-grid section-vh relative overflow-hidden bg-paper px-5 md:px-8">
      <div className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col justify-center py-16 md:py-20">
        <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink/50 uppercase">
          FAQ
        </p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.85rem,3.8vw,3rem)] leading-[1.12] font-semibold tracking-tight text-ink">
          Answers before you connect
        </h2>

        <ul className="faq-list mt-10 md:mt-12">
          {FAQS.map((item, i) => {
            const isOpen = open === i
            const panelId = `${baseId}-panel-${i}`
            const buttonId = `${baseId}-btn-${i}`
            return (
              <li key={item.q} className={`faq-item${isOpen ? ' is-open' : ''}`}>
                <button
                  id={buttonId}
                  type="button"
                  className="faq-trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="faq-question">{item.q}</span>
                  <span className="faq-icon" aria-hidden>
                    <Plus className="faq-icon-plus" />
                    <Minus className="faq-icon-minus" />
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="faq-panel"
                >
                  <div className="faq-panel-inner">
                    <p>{item.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
