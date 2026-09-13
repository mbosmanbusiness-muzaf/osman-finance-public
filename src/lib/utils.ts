import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Finite number or fallback — the single guard against NaN/Infinity leaking into UI. */
export function fin(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : fallback
}

/** Safe division: returns fallback when denominator is 0 / non-finite. */
export function safeDiv(a: number, b: number, fallback = 0): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback
  const r = a / b
  return Number.isFinite(r) ? r : fallback
}

export function sum(arr: number[]): number {
  let s = 0
  for (const v of arr) s += fin(v)
  return s
}

export function mean(arr: number[]): number {
  return arr.length ? sum(arr) / arr.length : 0
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const v = sum(arr.map((x) => (fin(x) - m) ** 2)) / (arr.length - 1)
  return Math.sqrt(v)
}

/** Coefficient of variation in % (0 when mean is 0). */
export function cv(arr: number[]): number {
  const m = mean(arr)
  return m === 0 ? 0 : Math.abs(stdDev(arr) / m) * 100
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, fin(n)))
}

export function pctChange(curr: number, prev: number): number {
  return safeDiv(fin(curr) - fin(prev), Math.abs(fin(prev)), 0) * 100
}

export function round(n: number, d = 0): number {
  const f = 10 ** d
  return Math.round(fin(n) * f) / f
}

export function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of arr) {
    const k = key(item)
    ;(out[k] ||= []).push(item)
  }
  return out
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

/** Deterministic PRNG (mulberry32) so demo data is reproducible. */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    /** uniform in [min, max] */
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    /** approx normal via sum of uniforms */
    normal: (mu = 0, sigma = 1) => {
      let s = 0
      for (let i = 0; i < 6; i++) s += next()
      return mu + ((s - 3) / Math.sqrt(0.5)) * sigma
    },
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
