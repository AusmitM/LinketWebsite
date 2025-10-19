import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STORIES, getStory } from "@/lib/stories";

export async function generateStaticParams() {
  return STORIES.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata(context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const story = getStory(slug);
  if (!story) {
    return {
      title: "Story not found",
    };
  }
  return {
    title: `${story.title} | Linket story`,
    description: story.summary,
  };
}

export default async function StoryDetail(context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const story = getStory(slug);
  if (!story) notFound();


  return (
    <main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <div className="mb-6">
        <Link href="/stories" className="text-sm text-muted-foreground hover:underline">&larr; Back to stories</Link>
      </div>
      <header className="rounded-3xl border bg-gradient-to-br from-[#bae6fd]/60 via-[#fecdd3]/60 to-[#a7f3d0]/60 p-8 shadow-sm md:p-10">
        <span className="mb-3 inline-block rounded-full bg-white/70 px-3 py-1 text-xs uppercase tracking-wide text-[color:var(--foreground)]">{story.badge}</span>
        <h1 className="text-3xl font-semibold text-[#0f172a]">{story.heroTitle}</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">{story.heroDescription}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {story.metrics.map((metric) => (
            <Card key={metric.label} className="rounded-2xl border-white/40 bg-white/80">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </header>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {story.highlights.map((highlight) => (
          <Card key={highlight.title} className="rounded-2xl border bg-card">
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-foreground">{highlight.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{highlight.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border bg-card/70 p-6 shadow-inner md:p-8">
        <blockquote className="text-lg font-medium text-foreground">&quot;{story.quote.text}&quot;</blockquote>
        <p className="mt-4 text-sm text-muted-foreground">-- {story.quote.author}, {story.quote.role}</p>
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        {story.actions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant={action.variant === "secondary" ? "outline" : "default"}
            className="rounded-full"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </section>
    </main>
  );
}
