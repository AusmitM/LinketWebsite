import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ClosingCTA() {
  return (
    <section id="get-started" className="border-t bg-muted/20">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Ready to share a clearer first impression?</h2>
        <p className="text-sm text-muted-foreground">
          Pick your colours, add your details, and ship an accessible NFC keychain in minutes.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/customize">Start customizing</Link>
        </Button>
        <p className="text-xs text-muted-foreground">Free shipping over $75 and guided support on every order.</p>
      </div>
    </section>
  );
}
