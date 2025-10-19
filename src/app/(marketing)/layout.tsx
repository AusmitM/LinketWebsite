import type { ReactNode } from "react";

export const metadata = {
  title: {
    default: "NFC Keychains — Your First Impression",
    template: "%s | Linket Connect",
  },
  description: "Custom NFC keychains that share your digital profile with a tap.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
