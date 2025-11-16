import { Pencil, Sparkles, Star } from "lucide-react";

import { CreativePricing } from "@/components/ui/creative-pricing";
import type { PricingTier } from "@/components/ui/creative-pricing";

const sampleTiers: PricingTier[] = [
  {
    name: "Creator",
    icon: <Pencil className="h-6 w-6" />,
    price: 29,
    description: "Perfect for short video beginners",
    color: "amber",
    features: [
      "60-second Video Export",
      "10 Trending Templates",
      "Auto Text-to-Speech",
      "Basic Transitions",
    ],
  },
  {
    name: "Influencer",
    icon: <Star className="h-6 w-6" />,
    price: 79,
    description: "For serious content creators",
    color: "blue",
    features: [
      "3-minute Video Export",
      "Voice Effects & Filters",
      "Trending Sound Library",
      "Auto Captions & Subtitles",
    ],
    popular: true,
  },
  {
    name: "Pro Studio",
    icon: <Sparkles className="h-6 w-6" />,
    price: 149,
    description: "For viral content masters",
    color: "purple",
    features: [
      "Multi-clip Editing",
      "Green Screen Effects",
      "Viral Sound Detection",
      "Engagement Analytics",
    ],
  },
];

function CreativePricingDemo() {
  return <CreativePricing tiers={sampleTiers} />;
}

export { CreativePricingDemo };
