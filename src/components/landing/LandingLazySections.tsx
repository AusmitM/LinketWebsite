"use client";

import dynamic from "next/dynamic";

const FeatureSteps = dynamic(
  () =>
    import("@/components/ui/feature-section").then(
      (mod) => mod.FeatureSteps
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[36px] border border-foreground/5 bg-white/60 p-8 shadow-[0_35px_80px_rgba(15,23,42,0.08)] sm:p-12">
        <div className="mx-auto h-[420px] w-full max-w-5xl rounded-3xl bg-foreground/5" />
      </div>
    ),
  }
);

const TestimonialSlider = dynamic(
  () =>
    import("@/components/ui/testimonial-slider").then(
      (mod) => mod.TestimonialSlider
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[40px] border border-[#ffe4d6] bg-white/80 p-6 shadow-[0_35px_80px_rgba(14,34,56,0.2)]">
        <div className="mx-auto h-[360px] w-full max-w-5xl rounded-3xl bg-foreground/5" />
      </div>
    ),
  }
);

export { FeatureSteps, TestimonialSlider };
