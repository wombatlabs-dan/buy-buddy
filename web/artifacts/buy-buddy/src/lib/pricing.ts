export const MONTHLY_PRICE = 14.99;

/** Per-hunt fee: 2% of the item's going price, min $9, max $49. Never based on max budget. */
export function perHuntFee(goingPrice: number): number {
  return Math.min(49, Math.max(9, Math.round(0.02 * goingPrice * 100) / 100));
}

export const usd = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

/** Bundled images resolve against the app's base path; real listing photos are full URLs and pass through. */
export const asset = (p: string | undefined) =>
  !p ? `${import.meta.env.BASE_URL}images/l-box.jpg` : /^(https?:|data:)/.test(p) ? p : `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}`;
