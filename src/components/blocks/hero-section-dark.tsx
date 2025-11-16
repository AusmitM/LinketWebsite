import { HeroSection } from "@/components/ui/hero-section-dark";

function HeroSectionDemo() {
  return (
    <HeroSection
      title="Welcome to Our Platform"
      subtitle={{
        regular: "Transform your ideas into ",
        gradient: "beautiful digital experiences",
      }}
      description="Transform your ideas into reality with our comprehensive suite of development tools and resources."
      ctaText="Get Started"
      ctaHref="/signup"
      bottomImage={{
        light:
          "https://images.unsplash.com/photo-1506765515384-028b60a970df?auto=format&fit=crop&w=1600&q=80",
        dark: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
      }}
      gridOptions={{
        angle: 65,
        opacity: 0.4,
        cellSize: 50,
        lightLineColor: "#4a4a4a",
        darkLineColor: "#2a2a2a",
      }}
    />
  );
}

export { HeroSectionDemo };
export { HeroSection } from "@/components/ui/hero-section-dark";
