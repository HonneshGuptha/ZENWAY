/**
 * Indian Mobile Phone Number Canonicalization and Validation
 * ZENWAY Canonical Format: +91XXXXXXXXXX (E.164 format with Indian country code)
 *
 * Rules:
 * - Must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.
 * - Accepts input with or without "+91", "91", or leading "0".
 * - Ignores spaces, hyphens, and parenthesis punctuation.
 */

export function normalizeIndianPhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== "string") return null

  // Extract all digits
  const rawDigits = phone.replace(/\D/g, "")
  let tenDigitPhone = rawDigits

  if (rawDigits.length === 12 && rawDigits.startsWith("91")) {
    tenDigitPhone = rawDigits.slice(2)
  } else if (rawDigits.length === 11 && rawDigits.startsWith("0")) {
    tenDigitPhone = rawDigits.slice(1)
  }

  // Must be exactly 10 digits and start with 6-9
  if (tenDigitPhone.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigitPhone)) {
    return null
  }

  return `+91${tenDigitPhone}`
}

export function isValidIndianPhone(phone?: string | null): boolean {
  return normalizeIndianPhone(phone) !== null
}

export function extract10DigitPhone(phone?: string | null): string | null {
  const normalized = normalizeIndianPhone(phone)
  return normalized ? normalized.slice(3) : null
}

export function formatIndianPhoneDisplay(phone?: string | null): string {
  const normalized = normalizeIndianPhone(phone)
  if (!normalized) return phone?.trim() || ""
  const tenDigit = normalized.slice(3)
  return `+91 ${tenDigit.slice(0, 5)} ${tenDigit.slice(5)}`
}
