import Image from "next/image"

export default function LogoStrip() {
  const logos = [
    { src: "/logos/logo1.svg", alt: "CampusX" },
    { src: "/logos/logo2.svg", alt: "HackFest" },
    { src: "/logos/logo3.svg", alt: "PopUpCo" },
    { src: "/logos/logo4.svg", alt: "OceanUni" },
  ]
  return (
    <section id="trust" className="border-y bg-background/60 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-4 text-center text-sm text-muted-foreground">Trusted at hackathons, pop-ups, and campus orgs.</p>
        <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 sm:gap-10" aria-label="Trusted by">
          {logos.map((l) => (
            <li key={l.src} className="grayscale transition hover:grayscale-0">
              <Image src={l.src} alt={l.alt} width={120} height={36} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
