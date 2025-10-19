"use client";

import Script from "next/script";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/components/system/toaster";
import { useCustomization } from "@/components/providers/customization-provider";
import type { Persona } from "@/components/providers/customization-provider";

const QUICK_REPLIES: Array<{ label: string; template: string; persona: Persona }> = [
  {
    label: "Wholesale inquiry",
    template: "Hi Linket! We’re interested in outfitting our retail team with 25 Linkets. Can you share bulk pricing and timeline?",
    persona: "business",
  },
  {
    label: "Event pack quote",
    template: "Hello! We’re hosting a 200-person summit and want Linket badges with sponsor links. What is the turnaround?",
    persona: "event",
  },
  {
    label: "Sample request",
    template: "Hi there, could you send a sample Linket so our leadership team can review the finish?",
    persona: "other",
  },
];

export default function ContactPage() {
  const { persona, setPersona } = useCustomization();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setName("");
      setEmail("");
      setMessage("");
      toast({ title: "Message sent", description: "We’ll get back soon.", variant: "success" });
    } catch (err) {
      toast({ title: "Could not send", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function applyQuickReply(reply: (typeof QUICK_REPLIES)[number]) {
    setMessage(reply.template);
    setPersona(reply.persona);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="mb-6 text-3xl font-semibold text-[#0f172a]">Contact</h1>
      <Script id="contact-faq-jsonld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Do I need an app to read Linket?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. Any modern smartphone can tap or scan a Linket without downloading an app.",
              },
            },
            {
              "@type": "Question",
              name: "Can I change my Linket username?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Update it from your dashboard whenever you like—as long as the handle is available.",
              },
            },
            {
              "@type": "Question",
              name: "How do you handle my data?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We only store the essentials required to power your Linket and give you analytics.",
              },
            },
          ],
        })}
      </Script>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Quick replies:</span>
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply.label}
                  type="button"
                  onClick={() => applyQuickReply(reply)}
                  className="rounded-full border border-dashed px-3 py-1 text-xs transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  {reply.label}
                </button>
              ))}
            </div>
            <form className="space-y-4" onSubmit={onSubmit} aria-label="Contact form">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <p className="text-xs text-muted-foreground">We’ll reply from hello@linket.io within a day.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Tip: Tell us quantities, deadline, and where you’ll use Linket. Current vibe: {persona || "we’ll tailor it"}.</p>
              </div>
              <Button className="rounded-2xl bg-[#0f172a] text-white hover:bg-[#0f172a]/90" disabled={loading} aria-label="Send message">
                {loading ? "Sending…" : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>FAQ</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger>Do I need an app?</AccordionTrigger>
                <AccordionContent>No. Anyone can scan with a phone camera.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Can I change my username?</AccordionTrigger>
                <AccordionContent>Yes, if it’s available.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Is my data private?</AccordionTrigger>
                <AccordionContent>We only store the essentials for your profile.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}