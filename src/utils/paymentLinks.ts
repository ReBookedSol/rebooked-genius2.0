/**
 * Paystack plan codes - pre-created on Paystack dashboard
 * Pro: R99/month, Premium: R149/month
 */

export const PAYSTACK_PLAN_CODES = {
  tier1: 'PLN_cvwhsqa7cyk1570', // Pro
  tier2: 'PLN_rh3snaiqlwdl7gx', // Premium
} as const;

export const ANNUAL_PRICES = {
  tier1: 79, // R79/mo billed annually (R948)
  tier2: 129, // R129/mo billed annually (R1548)
} as const;

export type SubscriptionTierKey = keyof typeof PAYSTACK_PLAN_CODES;

/**
 * Get pending tier from sessionStorage
 */
export function getPendingTier(): SubscriptionTierKey | null {
  const tier = sessionStorage.getItem('pendingTier');
  if (tier === 'tier1' || tier === 'tier2') return tier;
  return null;
}

/**
 * Clear pending tier from sessionStorage
 */
export function clearPendingTier(): void {
  sessionStorage.removeItem('pendingTier');
  sessionStorage.removeItem('pendingPaymentType');
}
