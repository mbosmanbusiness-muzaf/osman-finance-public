import '@testing-library/jest-dom/vitest'

// jsdom polyfills for Recharts / Radix
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } })) as unknown as typeof window.matchMedia
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
if (!('PointerEvent' in window)) (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:mock'

// Node 25+ o'zining localStorage'ini global'ga qo'yadi (--localstorage-file bo'lmasa metodlarsiz) va jsdom'nikini to'sadi
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const data = new Map<string, string>()
  const storage = {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (k: string) => { data.delete(k) },
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}
