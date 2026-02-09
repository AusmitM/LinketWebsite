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
      <div className="rounded-[28px] border border-foreground/5 bg-white/60 p-4 shadow-[0_35px_80px_rgba(15,23,42,0.08)] sm:rounded-[36px] sm:p-8 md:p-12">
        <div className="mx-auto h-[280px] w-full max-w-5xl rounded-3xl bg-foreground/5 sm:h-[360px] md:h-[420px]" />
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
      <div className="rounded-[28px] border border-[#ffe4d6] bg-white/80 p-4 shadow-[0_35px_80px_rgba(14,34,56,0.2)] sm:rounded-[40px] sm:p-6">
        <div className="mx-auto h-[240px] w-full max-w-5xl rounded-3xl bg-foreground/5 sm:h-[320px] md:h-[360px]" />
      </div>
    ),
  }
);

export { FeatureSteps, TestimonialSlider };
