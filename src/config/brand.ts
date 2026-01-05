export const brand = {
  /**
   * Primary brand name used in titles and headings.
   */
  name: "Linket Connect",
  /**
   * Short variant that fits small buttons (falls back to `name`).
   */
  shortName: "Linket",
  /**
   * One-line promise used across metadata and hero copy.
   */
  tagline: "Don't just share it... LINKET!.",
  /**
   * Optional horizontal logo that includes the wordmark.
   * Place your file at /public/brand/logo-full.svg (or adjust this path).
   */
  logo: "/brand/logo-full.svg",
  /**
   * Optional compact mark for the navbar avatar badge.
   * Place your file at /public/brand/logo-mark.svg (or adjust this path).
   */
  logomark: "/brand/logo-mark.svg",
  /**
   * Short marketing blurb reused in footer and SEO fields.
   */
  blurb: "Linket keychains share your digital profile instantly with NFC and QR backed by live editing.",
};

export function hasBrandLogo() {
  return Boolean(brand.logo);
}

export function hasBrandMark() {
  return Boolean(brand.logomark || brand.logo);
}
