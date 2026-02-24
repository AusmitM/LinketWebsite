export type MonthlyYearlyRate = {
  monthly: number;
  yearly: number;
};

export type PublicPricingSnapshot = {
  individual: {
    freeWebOnly: {
      monthly: number;
      billingLabel: string;
    };
    webPlusLinketBundle: {
      oneTime: number;
      includesProMonths: number;
    };
    paidWebOnlyPro: {
      initial: MonthlyYearlyRate;
      loyalty: {
        name: string;
        requiredMonths: number;
        requiredPaidDays: number;
        appliesTo: "personal";
        rate: MonthlyYearlyRate;
      };
    };
  };
  business: {
    generic: {
      minUnits: number;
      hardwareOneTimePerLinket: number;
      softwarePerUserMonthly: number;
    };
    custom: {
      minUnits: number;
      hardwareOneTimePerLinketRange: {
        min: number;
        max: number;
      };
      setupOneTime: number;
      softwarePerUserMonthly: number;
    };
  };
};

export type PersonalProLoyaltyStatus = {
  eligible: boolean;
  startedAt: string | null;
  eligibleOn: string | null;
  daysUntilEligible: number | null;
  source: "stripe_subscription_periods" | "none" | "unavailable";
  discountName: string;
  requiredMonths: number;
  requiredPaidDays: number;
  totalPaidDays: number;
  appliesTo: "personal";
  initialRate: MonthlyYearlyRate;
  loyaltyRate: MonthlyYearlyRate;
  currentRate: MonthlyYearlyRate;
};

const PUBLIC_PRICING: PublicPricingSnapshot = {
  individual: {
    freeWebOnly: {
      monthly: 0,
      billingLabel: "free + limited features",
    },
    webPlusLinketBundle: {
      oneTime: 59,
      includesProMonths: 12,
    },
    paidWebOnlyPro: {
      initial: {
        monthly: 7,
        yearly: 70,
      },
      loyalty: {
        name: "Loyalty discount",
        requiredMonths: 12,
        requiredPaidDays: 365,
        appliesTo: "personal",
        rate: {
          monthly: 6,
          yearly: 60,
        },
      },
    },
  },
  business: {
    generic: {
      minUnits: 5,
      hardwareOneTimePerLinket: 39,
      softwarePerUserMonthly: 6,
    },
    custom: {
      minUnits: 5,
      hardwareOneTimePerLinketRange: {
        min: 49,
        max: 69,
      },
      setupOneTime: 499,
      softwarePerUserMonthly: 6,
    },
  },
};

export function getPublicPricingSnapshot(): PublicPricingSnapshot {
  return PUBLIC_PRICING;
}

export function formatUsd(amount: number) {
  return `$${amount}`;
}

export function formatMonthly(amount: number) {
  return `${formatUsd(amount)}/month`;
}

export function formatYearly(amount: number) {
  return `${formatUsd(amount)}/year`;
}

export function getPersonalProPriceLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  return formatMonthly(pricing.individual.paidWebOnlyPro.initial.monthly);
}

export function getPersonalProBillingLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  return `or ${formatUsd(pricing.individual.paidWebOnlyPro.initial.yearly)}/year`;
}

export function getPersonalProLoyaltyFeature(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  const loyalty = pricing.individual.paidWebOnlyPro.loyalty;
  return `${loyalty.name}: after ${loyalty.requiredPaidDays} total paid days (continuous or discontinuous), renew at ${formatMonthly(loyalty.rate.monthly)} or ${formatYearly(loyalty.rate.yearly)}`;
}

export function getBundleBillingLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  const bundle = pricing.individual.webPlusLinketBundle;
  return `${formatUsd(bundle.oneTime)} one-time, then optional Pro renewal after year 1`;
}

export function getBusinessGenericPriceLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  return `${formatUsd(pricing.business.generic.hardwareOneTimePerLinket)}/Linket`;
}

export function getBusinessGenericBillingLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  return `one-time hardware purchase + ${formatUsd(pricing.business.generic.softwarePerUserMonthly)}/user/month`;
}

export function getBusinessCustomPriceLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  const range = pricing.business.custom.hardwareOneTimePerLinketRange;
  return `${formatUsd(range.min)}-${formatUsd(range.max)}/Linket`;
}

export function getBusinessCustomBillingLabel(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  return `${formatUsd(pricing.business.custom.setupOneTime)} custom design setup + ${formatUsd(pricing.business.custom.softwarePerUserMonthly)}/user/month`;
}

export function buildBestValueStarterFaqAnswer(
  pricing: PublicPricingSnapshot = PUBLIC_PRICING
) {
  const bundle = pricing.individual.webPlusLinketBundle;
  const loyalty = pricing.individual.paidWebOnlyPro.loyalty;
  return `The Web + Linket Bundle is ${formatUsd(bundle.oneTime)} one-time and includes ${bundle.includesProMonths} months of Paid Web-Only (Pro). After that, personal users keep accruing paid subscription time. Once you reach ${loyalty.requiredPaidDays} total paid days (continuous or discontinuous), the ${loyalty.name.toLowerCase()} applies: renew at ${formatMonthly(loyalty.rate.monthly)} or ${formatYearly(loyalty.rate.yearly)}.`;
}

export function buildDefaultPersonalProLoyaltyStatus(): PersonalProLoyaltyStatus {
  const pro = PUBLIC_PRICING.individual.paidWebOnlyPro;
  const requiredPaidDays = pro.loyalty.requiredPaidDays;
  return {
    eligible: false,
    startedAt: null,
    eligibleOn: null,
    daysUntilEligible: null,
    source: "unavailable",
    discountName: pro.loyalty.name,
    requiredMonths: pro.loyalty.requiredMonths,
    requiredPaidDays,
    totalPaidDays: 0,
    appliesTo: pro.loyalty.appliesTo,
    initialRate: { ...pro.initial },
    loyaltyRate: { ...pro.loyalty.rate },
    currentRate: { ...pro.initial },
  };
}
