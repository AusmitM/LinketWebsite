const REVIEWS = [
  {
    name: "Maya",
    role: "Student",
    quote: "I booked interviews faster because the keychain makes following up effortless.",
  },
  {
    name: "Leo",
    role: "Creator",
    quote: "Everything I link is readable on any phone. Fans never miss the booking button now.",
  },
  {
    name: "Ivy",
    role: "Founder",
    quote: "We rolled out 50 units for the team in a week and the analytics are easy to share.",
  },
] as const;

export default function Testimonials() {
  return (
    <section id="reviews" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 sm:px-6">
      <header className="mb-6 space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Trusted by inclusive teams</h2>
        <p className="text-sm text-muted-foreground">Feedback from customers who prioritise clarity and accessibility.</p>
      </header>
      <div className="space-y-4">
        {REVIEWS.map((review) => (
          <figure key={review.name} className="rounded-2xl border bg-card p-6 shadow-sm">
            <blockquote className="text-sm text-foreground">
              <p>&ldquo;{review.quote}&rdquo;</p>
            </blockquote>
            <figcaption className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{review.name}</span> &ndash; {review.role}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">4.9/5 average rating from teams across recruiting, events, and hospitality.</p>
    </section>
  );
}
