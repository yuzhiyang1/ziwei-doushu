import type { BirthInfo } from './ziwei/types';
import { calculateTrueSolarTime, isValidGregorianDate, resolveZiweiDayOffset, shiftGregorianDate } from './ziwei/true-solar-time';

export interface LocalBirthInput {
  year: string; month: string; day: string; clockHour: string; clockMinute: string;
  unknownTime: boolean; longitude: number; province: string; city: string;
  gender: 'male' | 'female'; name: string;
}

/** Convert raw standard Beijing clock input exactly once; the engine accepts the resulting chart day. */
export function resolveLocalBirth(form: LocalBirthInput): BirthInfo {
  const year = Number(form.year), month = Number(form.month), day = Number(form.day);
  if (year < 1900 || year > new Date().getFullYear() || !isValidGregorianDate(year, month, day)) throw new RangeError('出生日期无效');
  const base = { year, month, day, gender: form.gender, name: form.name || undefined, province: form.province || undefined, city: form.city || undefined, longitude: form.province ? form.longitude : undefined };
  if (form.unknownTime) return { ...base, hour: 0, birthTimeUnknown: true };
  const clockHour = Number(form.clockHour), clockMinute = Number(form.clockMinute);
  if (!Number.isInteger(clockHour) || clockHour < 0 || clockHour > 23 || !Number.isInteger(clockMinute) || clockMinute < 0 || clockMinute > 59) throw new RangeError('出生时间无效');
  const solar = calculateTrueSolarTime({ ...base, clockHour, clockMinute });
  const chartDate = shiftGregorianDate(base, resolveZiweiDayOffset(solar, 'next-day'));
  return { ...base, ...chartDate, hour: solar.branch, origInput: { year, month, day, clockHour, clockMinute } };
}
