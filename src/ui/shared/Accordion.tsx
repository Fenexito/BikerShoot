import { useState, type ReactNode } from 'react'
import { AnimateIcon } from '../animate-icons/icon'
import { Plus } from '../animate-icons/icons/Plus'
import { cn } from '../../lib/cn'

export interface AccordionItem {
  question: string
  answer: ReactNode
}

export function Accordion({ items, defaultOpen = 0 }: { items: AccordionItem[]; defaultOpen?: number | null }) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={item.question} className="overflow-hidden rounded-3xl bg-muted">
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold"
              >
                {item.question}
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-45',
                  )}
                >
                  <Plus size={18} />
                </span>
              </button>
            </AnimateIcon>
            <div
              className={cn(
                'grid transition-all duration-200 ease-out',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-5 text-sm text-muted-foreground">{item.answer}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
