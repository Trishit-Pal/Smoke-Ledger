import { z } from 'zod';

export interface CountryConfig {
  readonly code: string;
  readonly label: string;
  readonly dial: string;
  readonly localLength: number;
  readonly regex: RegExp;
  readonly placeholder: string;
}

export const SUPPORTED_COUNTRIES: readonly CountryConfig[] = [
  {
    code: 'IN',
    label: 'IN +91',
    dial: '+91',
    localLength: 10,
    regex: /^[6-9]\d{9}$/,
    placeholder: '9876543210',
  },
  {
    code: 'US',
    label: 'US +1',
    dial: '+1',
    localLength: 10,
    regex: /^\d{10}$/,
    placeholder: '4155551234',
  },
  {
    code: 'GB',
    label: 'GB +44',
    dial: '+44',
    localLength: 10,
    regex: /^7\d{9}$/,
    placeholder: '7700123456',
  },
  {
    code: 'AU',
    label: 'AU +61',
    dial: '+61',
    localLength: 9,
    regex: /^4\d{8}$/,
    placeholder: '412345678',
  },
  {
    code: 'AE',
    label: 'AE +971',
    dial: '+971',
    localLength: 9,
    regex: /^5[024568]\d{7}$/,
    placeholder: '501234567',
  },
];

export const DEFAULT_COUNTRY: CountryConfig = SUPPORTED_COUNTRIES[0];

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const indianMobileZod = z
  .string()
  .trim()
  .regex(INDIAN_MOBILE_REGEX, 'Enter a 10-digit Indian mobile starting with 6, 7, 8 or 9');

export const otpCodeZod = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export function getCountryByCode(code: string | undefined | null): CountryConfig | undefined {
  if (!code) return undefined;
  return SUPPORTED_COUNTRIES.find((c) => c.code === code);
}

export function toE164(country: CountryConfig, localNumber: string): string {
  return `${country.dial}${localNumber.trim()}`;
}

export function toE164In(local: string): string {
  return `+91${local.trim()}`;
}

export function isPhoneOtpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED !== 'false';
}
