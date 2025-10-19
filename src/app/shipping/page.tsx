import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Linket Shipping Policy",
};

export default function ShippingPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="mb-4 text-3xl font-semibold text-[#0f172a]">Shipping policy</h1>
      <p className="text-sm text-muted-foreground">
        We’re finalizing this policy right now. Need details? Email <a className="underline" href="mailto:hello@linket.io">hello@linket.io</a> and we’ll reply within a day.
      </p>
    </main>
  );
}
