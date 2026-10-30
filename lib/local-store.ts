import type { BirthInfo, ZiweiChart } from './ziwei/types';

export interface LocalMessage { role: 'user' | 'assistant'; content: string }
export interface LocalProfile { id: string; birth: BirthInfo; savedAt: number }
export interface LocalChat { id: string; messages: LocalMessage[]; savedAt: number }
export interface LocalBackup { format: 'ziwei-local'; version: 1; profiles: LocalProfile[]; chats: LocalChat[] }
const DB_NAME = 'ziwei-personal-v1';
const MAX_BACKUP = 5 * 1024 * 1024;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('浏览器不支持 IndexedDB，无法保存本地数据'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('profiles', { keyPath: 'id' });
      req.result.createObjectStore('chats', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('无法打开本地数据库，请检查浏览器隐私或存储设置'));
    req.onblocked = () => reject(new Error('本地数据库被另一标签页占用，请关闭其他页面重试'));
  });
}
async function transact<T>(store: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = operation(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('本地数据操作失败，可能存储空间已满')); };
  });
}
/** Keep every saved dataset within the same validated limits as its portable backup. */
async function boundedPut(store: 'profiles' | 'chats', record: LocalProfile | LocalChat): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['profiles', 'chats'], 'readwrite');
    const profiles = tx.objectStore('profiles').getAll();
    const chats = tx.objectStore('chats').getAll();
    let completed = 0, failure: unknown;
    const ready = () => {
      if (++completed !== 2) return;
      try {
        const data: LocalBackup = { format: 'ziwei-local', version: 1, profiles: profiles.result, chats: chats.result };
        if (store === 'profiles') data.profiles = [...data.profiles.filter(p => p.id !== record.id), record as LocalProfile];
        else data.chats = [...data.chats.filter(c => c.id !== record.id), record as LocalChat];
        parseBackup(JSON.stringify(data, null, 2));
        tx.objectStore(store).put(record);
      } catch (error) { failure = error; tx.abort(); }
    };
    profiles.onsuccess = chats.onsuccess = ready;
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(failure ?? new Error('保存失败，请检查浏览器存储空间')); };
  });
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('备份对象格式不正确');
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error('备份数值超出允许范围');
  return value;
}
function string(value: unknown, max = 200): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('备份文本格式不正确');
  return value;
}
export function validateBirth(value: unknown): BirthInfo {
  const b = object(value);
  const year = integer(b.year, 1900, 2100), month = integer(b.month, 1, 12), day = integer(b.day, 1, 31);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('备份含不存在的出生日期');
  if (b.gender !== 'male' && b.gender !== 'female') throw new Error('备份性别格式不正确');
  const result: BirthInfo = { year, month, day, hour: integer(b.hour, 0, 11), gender: b.gender };
  if (b.birthTimeUnknown !== undefined) {
    if (typeof b.birthTimeUnknown !== 'boolean') throw new Error('未知时辰标记无效');
    result.birthTimeUnknown = b.birthTimeUnknown;
  }
  if (b.schoolConfig !== undefined) {
    const school = object(b.schoolConfig);
    if (!['default', 'XD1', 'XD2', 'ZZ'].includes(school.brightnessSchool as string)
      || !['split', 'next-month', 'prev-month', 'origin-month'].includes(school.leapMonth as string)
      || !['next-day', 'current-day'].includes(school.lateZishi as string)) throw new Error('排盘口径配置无效');
    result.schoolConfig = {
      brightnessSchool: school.brightnessSchool as NonNullable<BirthInfo['schoolConfig']>['brightnessSchool'],
      leapMonth: school.leapMonth as NonNullable<BirthInfo['schoolConfig']>['leapMonth'],
      lateZishi: school.lateZishi as NonNullable<BirthInfo['schoolConfig']>['lateZishi'],
    };
  }
  for (const key of ['name', 'province', 'city'] as const) if (b[key] !== undefined) result[key] = string(b[key]);
  if (b.longitude !== undefined) {
    if (typeof b.longitude !== 'number' || !Number.isFinite(b.longitude) || Math.abs(b.longitude) > 180) throw new Error('经度无效');
    result.longitude = b.longitude;
  }
  if (b.origInput !== undefined) {
    const o = object(b.origInput);
    const original = validateBirth({ ...o, hour: 0, gender: b.gender });
    result.origInput = { year: original.year, month: original.month, day: original.day, clockHour: integer(o.clockHour, 0, 23), clockMinute: integer(o.clockMinute, 0, 59) };
  }
  return result;
}
export function chartId(chart: ZiweiChart, context?: string): string { return context ? JSON.stringify({ birth: validateBirth(chart.birthInfo), context }) : birthId(chart.birthInfo); }
function birthId(birth: BirthInfo): string { return JSON.stringify(validateBirth(birth)); }
export async function saveProfile(birth: BirthInfo): Promise<void> {
  const safe = validateBirth(birth);
  await boundedPut('profiles', { id: birthId(safe), birth: safe, savedAt: Date.now() });
}
export async function listProfiles(): Promise<LocalProfile[]> {
  const profiles = await transact<LocalProfile[]>('profiles', 'readonly', s => s.getAll());
  return profiles.sort((a, b) => b.savedAt - a.savedAt);
}
export async function deleteProfile(id: string): Promise<void> { await transact('profiles', 'readwrite', s => s.delete(id)); }
export async function loadChat(chart: ZiweiChart, context?: string): Promise<LocalMessage[]> {
  const data = await transact<LocalChat | undefined>('chats', 'readonly', s => s.get(chartId(chart, context)));
  return data?.messages ?? [];
}
export async function saveChat(chart: ZiweiChart, messages: LocalMessage[], context?: string): Promise<void> {
  await boundedPut('chats', { id: chartId(chart, context), messages, savedAt: Date.now() });
}
export async function exportBackup(): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['profiles', 'chats'], 'readonly');
    const profiles = tx.objectStore('profiles').getAll();
    const chats = tx.objectStore('chats').getAll();
    tx.oncomplete = () => { db.close(); resolve(JSON.stringify({ format: 'ziwei-local', version: 1, profiles: profiles.result, chats: chats.result }, null, 2)); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('备份读取失败')); };
  });
}
export function parseBackup(text: string): LocalBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP) throw new Error('备份过大（上限 5 MB）');
  const data = object(JSON.parse(text));
  if (data.format !== 'ziwei-local' || data.version !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.chats)) throw new Error('不支持的备份格式或版本');
  if (data.profiles.length > 1000 || data.chats.length > 1000) throw new Error('备份记录过多');
  const profiles = data.profiles.map(value => {
    const p = object(value), birth = validateBirth(p.birth);
    return { id: birthId(birth), birth, savedAt: integer(p.savedAt, 0, Number.MAX_SAFE_INTEGER) };
  });
  const chats = data.chats.map(value => {
    const c = object(value);
    const key = object(JSON.parse(string(c.id, 100000)));
    const birth = validateBirth(key.birth ?? key);
    const id = key.birth ? JSON.stringify({ birth, context: string(key.context, 90000) }) : birthId(birth);
    if (!Array.isArray(c.messages) || c.messages.length > 200) throw new Error('问答记录格式无效或超过 200 条');
    const messages = c.messages.map(value => {
      const m = object(value);
      if (m.role !== 'user' && m.role !== 'assistant') throw new Error('问答角色无效');
      return { role: m.role, content: string(m.content, 50000) } as LocalMessage;
    });
    return { id, messages, savedAt: integer(c.savedAt, 0, Number.MAX_SAFE_INTEGER) };
  });
  return { format: 'ziwei-local', version: 1, profiles, chats };
}
/** Validate the whole file before any writes, then merge atomically; same IDs replace existing entries. */
export async function importBackup(text: string): Promise<void> {
  const backup = parseBackup(text), db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['profiles', 'chats'], 'readwrite');
    const profiles = tx.objectStore('profiles').getAll();
    const chats = tx.objectStore('chats').getAll();
    let completed = 0, failure: unknown;
    const ready = () => {
      if (++completed !== 2) return;
      try {
        const mergedProfiles = new Map<string, LocalProfile>(profiles.result.map((p: LocalProfile) => [p.id, p]));
        const mergedChats = new Map<string, LocalChat>(chats.result.map((c: LocalChat) => [c.id, c]));
        backup.profiles.forEach(p => mergedProfiles.set(p.id, p));
        backup.chats.forEach(c => mergedChats.set(c.id, c));
        parseBackup(JSON.stringify({ ...backup, profiles: [...mergedProfiles.values()], chats: [...mergedChats.values()] }, null, 2));
        backup.profiles.forEach(p => tx.objectStore('profiles').put(p));
        backup.chats.forEach(c => tx.objectStore('chats').put(c));
      } catch (error) { failure = error; tx.abort(); }
    };
    profiles.onsuccess = chats.onsuccess = ready;
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(failure ?? new Error('恢复失败，原有数据未改变')); };
  });
}
