export const PLANS = Object.freeze({
  month: {
    amount: 990,
    days: 30,
  },
  quarter: {
    amount: 2990,
    days: 90,
  },
  year: {
    amount: 9900,
    days: 365,
  },
});

export function isPlanType(value) {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}
