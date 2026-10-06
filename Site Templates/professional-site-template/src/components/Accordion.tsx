import { useState } from 'react'

interface Item {
  q: string
  a: string
}

export default function Accordion({ items }: { items: Item[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="accordion">
      {items.map(({ q, a }, i) => {
        const open = openIndex === i
        return (
          <div key={q} className={`accordion-item ${open ? 'is-open' : ''}`}>
            <h3>
              <button
                className="accordion-trigger"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : i)}
              >
                {q}
                <span className="accordion-icon" aria-hidden="true">{open ? '−' : '+'}</span>
              </button>
            </h3>
            {open && <p className="accordion-panel">{a}</p>}
          </div>
        )
      })}
    </div>
  )
}
