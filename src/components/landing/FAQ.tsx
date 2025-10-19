"use client"

import { useEffect, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { bindAnalyticsClicks } from "@/lib/analytics"

const QA = [
  { q: "Will it work with my phone?", a: "Yes, iOS/Android with NFC. QR fallback included." },
  { q: "Do I need an app?", a: "No app required to share or view." },
  { q: "How durable is it?", a: "Water-resistant, scratch-safe body." },
  { q: "Can I change my profile later?", a: "Yes, update anytime from your dashboard." },
  { q: "Shipping times?", a: "Ships in 3–5 business days." },
  { q: "Bulk/team discounts?", a: "Yes, contact us for team pricing." },
  { q: "What about privacy?", a: "You control what appears on your profile." },
  { q: "Returns & warranty?", a: "30-day returns and 1-year warranty." },
]

export default function FAQ() {
  const [value, setValue] = useState<string | undefined>(undefined)
  useEffect(() => bindAnalyticsClicks(), [])
  useEffect(() => {
    // Deep link open
    if (typeof window !== "undefined" && window.location.hash) {
      const id = decodeURIComponent(window.location.hash.slice(1))
      const idx = QA.findIndex((i) => i.q.toLowerCase().includes(id.toLowerCase()))
      if (idx >= 0) setValue(String(idx))
    }
  }, [])
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <h3 className="mb-4 text-xl font-semibold">FAQ</h3>
      <Accordion type="multiple" value={value ? [value] : undefined} onValueChange={() => {}}>
        {QA.map((qa, i) => (
          <AccordionItem key={qa.q} value={String(i)}>
            <AccordionTrigger className="text-left" data-analytics-id="faq_open_question">{qa.q}</AccordionTrigger>
            <AccordionContent>{qa.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-4 text-sm text-muted-foreground">Still have questions? <a className="underline" href="#footer">Contact us</a>.</div>
    </section>
  )
}
