"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Persona } from "@/components/providers/customization-provider";
import { useCustomization } from "@/components/providers/customization-provider";

const STEPS = ["Choose base", "Brand it", "Preview", "Checkout"] as const;
type StepIndex = 0 | 1 | 2 | 3;

type BaseOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  recommendedFor: Persona[];
};

type AddOn = {
  id: string;
  name: string;
  description: string;
  price: number;
  perUnit?: boolean;
};

type PresetConfig = {
  persona: Persona;
  baseId: string;
  primary: string;
  accent: string;
  initials: string;
  quantity?: number;
  addOns?: string[];
};

const BASE_OPTIONS: BaseOption[] = [
  {
    id: "classic",
    name: "Classic keychain",
    description: "Slim acrylic Linket with matte finish. Ideal everyday carry.",
    price: 19,
    recommendedFor: ["student", "creator", "other"],
  },
  {
    id: "badge",
    name: "Badge + lanyard",
    description: "Full badge with NFC + QR. Perfect for events and teams.",
    price: 29,
    recommendedFor: ["event", "business"],
  },
  {
    id: "premium",
    name: "Premium metal tag",
    description: "Anodized metal Linket with laser engraving and felt case.",
    price: 34,
    recommendedFor: ["creator", "business"],
  },
];

const ADD_ONS: AddOn[] = [
  {
    id: "engraving",
    name: "Logo engraving",
    description: "Add your logo or crest to the back of every Linket.",
    price: 5,
    perUnit: true,
  },
  {
    id: "rush",
    name: "48h rush production",
    description: "Jump the queue and ship within two business days.",
    price: 12,
  },
  {
    id: "gift",
    name: "Gift wrap set",
    description: "Includes recyclable box + thank-you insert for five units.",
    price: 15,
  },
];

const PRESETS: Record<string, PresetConfig> = {
  student: {
    persona: "student",
    baseId: "classic",
    primary: "#0f172a",
    accent: "#a7f3d0",
    initials: "MH",
    quantity: 1,
    addOns: ["engraving"],
  },
  creator: {
    persona: "creator",
    baseId: "premium",
    primary: "#f49490",
    accent: "#bae6fd",
    initials: "LR",
    quantity: 2,
    addOns: ["engraving"],
  },
  event: {
    persona: "event",
    baseId: "badge",
    primary: "#0f172a",
    accent: "#ffd7c5",
    initials: "EX",
    quantity: 50,
    addOns: ["rush"],
  },
  hospitality: {
    persona: "business",
    baseId: "badge",
    primary: "#7fc3e3",
    accent: "#f49490",
    initials: "CK",
    quantity: 5,
    addOns: ["gift"],
  },
};

const PERSONA_CHIPS: Array<{ persona: Persona; label: string; helper: string }> = [
  { persona: "student", label: "Students", helper: "Career fairs, campus tours" },
  { persona: "creator", label: "Creators", helper: "Shops, pop-ups, collabs" },
  { persona: "business", label: "Teams", helper: "Sales crews, retail staff" },
  { persona: "event", label: "Events", helper: "Badges + VIP" },
  { persona: "other", label: "Something else", helper: "We will tailor it with you" },
];

function CustomizePageContent() {
  const searchParams = useSearchParams();
  const { primaryColor, accentColor, initials, persona, setPrimaryColor, setAccentColor, setInitials, setPersona } = useCustomization();

  const [step, setStep] = useState<StepIndex>(0);
  const [selectedBase, setSelectedBase] = useState<BaseOption>(BASE_OPTIONS[0]);
  const [quantity, setQuantity] = useState(1);
  const [addOns, setAddOns] = useState<Record<string, boolean>>({});
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);

  useEffect(() => {
    const presetParam = searchParams.get("preset");
    if (!presetParam || appliedPreset === presetParam) return;
    const preset = PRESETS[presetParam];
    if (!preset) return;

    setAppliedPreset(presetParam);
    setPersona(preset.persona);
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
    setInitials(preset.initials);
    const base = BASE_OPTIONS.find((option) => option.id === preset.baseId);
    if (base) setSelectedBase(base);
    if (preset.quantity) setQuantity(preset.quantity);
    if (preset.addOns) {
      setAddOns(preset.addOns.reduce<Record<string, boolean>>((acc, id) => ({ ...acc, [id]: true }), {}));
    }
  }, [searchParams, appliedPreset, setPersona, setPrimaryColor, setAccentColor, setInitials]);

  const addOnsTotal = useMemo(() => {
    return ADD_ONS.reduce((sum, addOn) => {
      if (!addOns[addOn.id]) return sum;
      const addOnPrice = addOn.perUnit ? addOn.price * quantity : addOn.price;
      return sum + addOnPrice;
    }, 0);
  }, [addOns, quantity]);

  const baseTotal = selectedBase.price * quantity;
  const subtotal = baseTotal + addOnsTotal;
  const discount = quantity >= 10 ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal - discount >= 75 ? 0 : 4;
  const total = subtotal - discount + shipping;

  const canGoNext = step === 0 ? Boolean(selectedBase) : step === 1 ? true : step === 2 ? true : false;

  const previewStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
    }),
    [accentColor, primaryColor]
  );

  function nextStep() {
    if (step < 3 && canGoNext) {
      setStep((prev) => (prev + 1) as StepIndex);
    }
  }

  function prevStep() {
    if (step > 0) {
      setStep((prev) => (prev - 1) as StepIndex);
    }
  }

  function toggleAddOn(id: string) {
    setAddOns((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleQuantityChange(value: number) {
    const next = Number.isNaN(value) ? 1 : Math.min(250, Math.max(1, value));
    setQuantity(next);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold text-[#0f172a]">Build your Linket</h1>
        <p className="text-sm text-muted-foreground">
          Guided setup from preview to checkout. Start with a base, match your brand, then share it with the world.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <Stepper currentStep={step} />
          <div className="mt-6">
            {step === 0 && (
              <BaseStep
                persona={persona}
                selected={selectedBase}
                onSelect={setSelectedBase}
              />
            )}
            {step === 1 && (
              <BrandStep
                persona={persona}
                setPersona={setPersona}
                setPrimary={setPrimaryColor}
                setAccent={setAccentColor}
                setInitials={setInitials}
                primaryColor={primaryColor}
                accentColor={accentColor}
                initials={initials}
              />
            )}
            {step === 2 && (
              <PreviewStep
                selectedBase={selectedBase}
                previewStyle={previewStyle}
                initials={initials}
                addOns={addOns}
                quantity={quantity}
              />
            )}
            {step === 3 && (
              <CheckoutStep
                total={total}
                shipping={shipping}
                discount={discount}
                addOns={addOns}
              />
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={prevStep} disabled={step === 0}>
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={nextStep} disabled={!canGoNext} data-analytics-id={`customize_step_${step + 1}`}>
                Continue
              </Button>
            ) : (
              <Button size="lg" className="rounded-full" data-analytics-id="customize_checkout">
                Place preorder
              </Button>
            )}
          </div>
        </section>

        <OrderSummary
          selectedBase={selectedBase}
          quantity={quantity}
          onQuantityChange={handleQuantityChange}
          addOns={addOns}
          onToggleAddOn={toggleAddOn}
          discount={discount}
          shipping={shipping}
          total={total}
        />
      </div>
    </main>
  );
}

function Stepper({ currentStep }: { currentStep: StepIndex }) {
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm">
      {STEPS.map((label, index) => {
        const active = index === currentStep;
        const complete = index < currentStep;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                complete
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : active
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-muted text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className={cn("text-muted-foreground", (active || complete) && "text-foreground font-medium")}>{label}</span>
            {index < STEPS.length - 1 && <span className="text-muted-foreground">/</span>}
          </li>
        );
      })}
    </ol>
  );
}

function BaseStep({ persona, selected, onSelect }: { persona: Persona; selected: BaseOption; onSelect: (base: BaseOption) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">1. Choose your base</h2>
      <p className="text-sm text-muted-foreground">Pick the Linket style that fits how you share.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {BASE_OPTIONS.map((base) => {
          const recommended = persona && base.recommendedFor.includes(persona);
          const isSelected = selected.id === base.id;
          return (
            <button
              key={base.id}
              type="button"
              onClick={() => onSelect(base)}
              className={cn(
                "flex h-full flex-col rounded-3xl border bg-card p-4 text-left transition hover:border-[var(--primary)] hover:shadow-xl",
                isSelected && "border-[var(--primary)] shadow-lg"
              )}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-foreground">{base.name}</h3>
                <span className="text-sm font-semibold text-[var(--primary)]">${base.price}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{base.description}</p>
              {recommended && (
                <span className="mt-3 inline-flex w-fit rounded-full bg-[var(--accent)]/60 px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--foreground)]">
                  Recommended for you
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BrandStep({
  persona,
  setPersona,
  setPrimary,
  setAccent,
  setInitials,
  primaryColor,
  accentColor,
  initials,
}: {
  persona: Persona;
  setPersona: (persona: Persona) => void;
  setPrimary: (value: string) => void;
  setAccent: (value: string) => void;
  setInitials: (value: string) => void;
  primaryColor: string;
  accentColor: string;
  initials: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">2. Brand your Linket</h2>
        <p className="text-sm text-muted-foreground">Match your palette and update initials. Swap personas to see curated looks.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PERSONA_CHIPS.map((chip) => (
          <button
            key={chip.persona}
            onClick={() => setPersona(chip.persona)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              persona === chip.persona
                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                : "border-muted text-muted-foreground hover:border-[var(--primary)]"
            )}
            type="button"
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="primary-color">Primary color</Label>
          <Input id="primary-color" type="color" value={primaryColor} onChange={(e) => setPrimary(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accent-color">Accent color</Label>
          <Input id="accent-color" type="color" value={accentColor} onChange={(e) => setAccent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="initials">Initials</Label>
          <Input id="initials" value={initials} maxLength={3} onChange={(e) => setInitials(e.target.value.toUpperCase())} />
        </div>
      </div>
    </div>
  );
}

function PreviewStep({
  selectedBase,
  previewStyle,
  initials,
  addOns,
  quantity,
}: {
  selectedBase: BaseOption;
  previewStyle: CSSProperties;
  initials: string;
  addOns: Record<string, boolean>;
  quantity: number;
}) {
  const activeAddOns = ADD_ONS.filter((addOn) => addOns[addOn.id]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">3. Preview</h2>
        <p className="text-sm text-muted-foreground">Your Linket updates live. Rotate colors or initials above and watch it shift.</p>
      </div>
      <Card className="rounded-3xl border bg-card/80 p-6 shadow-lg">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <span className="rounded-full bg-[var(--accent)]/60 px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--foreground)]">
              {selectedBase.name}
            </span>
            <div className="rounded-3xl border shadow-lg" style={previewStyle}>
              <div className="flex h-52 items-center justify-center">
                <span className="rounded-full bg-white/85 px-6 py-3 text-3xl font-semibold text-slate-900 shadow">
                  {initials || "TC"}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Order details</h3>
            <p className="text-sm text-muted-foreground">{selectedBase.description}</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>Quantity</span>
                <span>{quantity}</span>
              </li>
              {activeAddOns.length > 0 ? (
                activeAddOns.map((addOn) => (
                  <li key={addOn.id} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{addOn.name}</span>
                    <span>Included</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">No add-ons selected.</li>
              )}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CheckoutStep({ total, shipping, discount, addOns }: { total: number; shipping: number; discount: number; addOns: Record<string, boolean> }) {
  const rushSelected = addOns["rush"];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">4. Checkout</h2>
      <p className="text-sm text-muted-foreground">
        We will send a secure invoice and proof within 24 hours. Most orders ship in under a week.
      </p>
      <div className="rounded-3xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>Shipping: {shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`} • Discount: {discount > 0 ? `-$${discount.toFixed(2)}` : "N/A"}</p>
        {rushSelected && <p className="mt-1 text-[var(--primary)]">Rush production selected — ships within 48 hours.</p>}
        <p className="mt-2 text-base font-semibold text-foreground">Total due: ${total.toFixed(2)}</p>
      </div>
      <p className="text-xs text-muted-foreground">Need purchase order or tax-exempt processing? Reply to the confirmation email and our concierge will handle it.</p>
    </div>
  );
}

function OrderSummary({
  selectedBase,
  quantity,
  onQuantityChange,
  addOns,
  onToggleAddOn,
  discount,
  shipping,
  total,
}: {
  selectedBase: BaseOption;
  quantity: number;
  onQuantityChange: (value: number) => void;
  addOns: Record<string, boolean>;
  onToggleAddOn: (id: string) => void;
  discount: number;
  shipping: number;
  total: number;
}) {
  return (
    <Card className="h-full rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            max={250}
            value={quantity}
            onChange={(e) => onQuantityChange(Number(e.target.value))}
            className="mt-1 w-28"
          />
          <p className="mt-1 text-xs text-muted-foreground">Bulk pricing kicks in at 10+ units (auto applied).</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Add-ons</p>
          {ADD_ONS.map((addOn) => (
            <label key={addOn.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border bg-muted/40 px-3 py-2">
              <div>
                <p className="font-medium text-foreground">{addOn.name}</p>
                <p className="text-xs text-muted-foreground">{addOn.description}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Switch checked={Boolean(addOns[addOn.id])} onCheckedChange={() => onToggleAddOn(addOn.id)} />
                <span className="text-xs text-muted-foreground">+${addOn.price}{addOn.perUnit ? " ea" : " order"}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="space-y-1 text-sm text-foreground">
          <div className="flex items-center justify-between">
            <span>{selectedBase.name} × {quantity}</span>
            <span>${(selectedBase.price * quantity).toFixed(2)}</span>
          </div>
          {ADD_ONS.filter((addOn) => addOns[addOn.id]).map((addOn) => (
            <div key={addOn.id} className="flex items-center justify-between text-muted-foreground">
              <span>{addOn.name}</span>
              <span>
                +${(addOn.perUnit ? addOn.price * quantity : addOn.price).toFixed(2)}
              </span>
            </div>
          ))}
          {discount > 0 && (
            <div className="flex items-center justify-between text-emerald-600">
              <span>Bulk discount</span>
              <span>- ${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-base font-semibold text-foreground">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div className="rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground">
          Free shipping on orders $75+. Need help? Text the concierge and we will configure it with you.
        </div>
      </CardContent>
    </Card>
  );
}
export default function CustomizePage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading configurator…</div>}>
      <CustomizePageContent />
    </Suspense>
  );
}
