import { applyLocalSchoolPatches, LOCAL_SCHOOL_OPTIONS } from './local-school-patches';
import { generateChart, setBrightnessSchool } from './ziwei/algorithm';
import { calculateTrueSolarTime, isValidGregorianDate, resolveZiweiDayOffset, shiftGregorianDate } from './ziwei/true-solar-time';
import type { BirthInfo, LocalSchoolConfig, ZiweiChart } from './ziwei/types';
export const LOCAL_SCHOOL_DEFAULTS: Readonly<LocalSchoolConfig> = { brightnessSchool: 'default', leapMonth: 'split', lateZishi: 'next-day' };
export function validateLocalSchoolConfig(value: unknown): LocalSchoolConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('流派配置格式无效');
  const c = value as Record<string, unknown>;
  if (!['default', 'XD1', 'XD2', 'ZZ'].includes(c.brightnessSchool as string) || !['split', 'next-month', 'prev-month', 'origin-month'].includes(c.leapMonth as string) || !['next-day', 'current-day'].includes(c.lateZishi as string)) throw new Error('不支持的流派配置');
  const result = { brightnessSchool: c.brightnessSchool, leapMonth: c.leapMonth, lateZishi: c.lateZishi } as LocalSchoolConfig;
  for (const key of Object.keys(LOCAL_SCHOOL_OPTIONS) as (keyof typeof LOCAL_SCHOOL_OPTIONS)[]) {
    const value = c[key];
    const choices: readonly string[] = LOCAL_SCHOOL_OPTIONS[key];
    if (value !== undefined && (typeof value !== 'string' || !choices.includes(value))) throw new Error('不支持的流派配置');
    if (value !== undefined && value !== choices[0]) Object.assign(result, { [key]: value });
  }
  return result;
}
/** Always derive chart day from original clock, never from an already corrected chart date. */
export function generateLocalChart(birth: BirthInfo, settings?: LocalSchoolConfig): ZiweiChart {
  const config = validateLocalSchoolConfig(settings ?? birth.schoolConfig ?? LOCAL_SCHOOL_DEFAULTS);
  const oldRule = birth.schoolConfig?.lateZishi ?? 'next-day';
  let resolved: BirthInfo = { ...birth, schoolConfig: config };
  if (birth.origInput && !birth.birthTimeUnknown) {
    const original = birth.origInput;
    if (!isValidGregorianDate(original.year, original.month, original.day) || !Number.isInteger(original.clockHour) || original.clockHour < 0 || original.clockHour > 23 || !Number.isInteger(original.clockMinute) || original.clockMinute < 0 || original.clockMinute > 59) throw new Error('原始出生时间无效');
    const solar = calculateTrueSolarTime({ ...original, longitude: birth.longitude });
    const date = shiftGregorianDate(original, resolveZiweiDayOffset(solar, config.lateZishi));
    resolved = { ...resolved, ...date, hour: solar.branch };
  } else if (oldRule !== config.lateZishi) {
    throw new Error('缺少已知的原始钟表时间，不能切换晚子时规则；请重新输入准确出生时间。');
  }
  try {
    setBrightnessSchool(config.brightnessSchool);
    return applyLocalSchoolPatches(generateChart(resolved, { leapMonth: config.leapMonth }), config);
  } finally {
    // Chart generation is synchronous; no other chart can observe a retained setting.
    setBrightnessSchool('default');
  }
}
