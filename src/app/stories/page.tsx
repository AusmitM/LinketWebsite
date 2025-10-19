import Link from "next/link";
import { STORIES } from "@/lib/stories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Customer stories",
  description: "See how students, creators, and teams are using Linket to share who they are with a tap.",
};

export default function StoriesIndex() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold text-[#0f172a]">Customer stories</h1>
        <p className="mt-2 text-base text-muted-foreground">Real teams using Linket to make first impressions unforgettable.</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        {STORIES.map((story) => (
          <Card key={story.slug} className="rounded-3xl border bg-card">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <span className="w-fit rounded-full bg-[var(--accent)]/60 px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--foreground)]">{story.badge}</span>
              <h2 className="text-xl font-semibold text-foreground">{story.title}</h2>
              <p className="text-sm text-muted-foreground">{story.summary}</p>
              <div className="flex-1" />
              <Button asChild variant="ghost" className="justify-start rounded-full">
                <Link href={`/stories/${story.slug}`}>Read story</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

