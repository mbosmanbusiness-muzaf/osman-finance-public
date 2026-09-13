import type { Dataset, KpiTarget } from '@/types'

const t = (key: string, label: string, unit: KpiTarget['unit'], target: number, normMin: number, normMax: number, lowerIsBetter: boolean): KpiTarget =>
  ({ key, label, unit, target, normMin, normMax, lowerIsBetter })

/** Admin KPI maqsadlari kiritilmagan bo'lsa — standart normalar (panellar uchun yagona manba). */
export const DEFAULT_KPI_TARGETS: Record<string, KpiTarget> = {
  arOverdueShare: t('arOverdueShare', "Muddati o'tgan debitorlik ulushi", 'pct', 15, 0, 20, true),
  apOverdueShare: t('apOverdueShare', "Muddati o'tgan kreditorlik ulushi", 'pct', 10, 0, 15, true),
  currentRatio: t('currentRatio', 'Joriy likvidlik', 'ratio', 1.8, 1.5, 2.5, false),
  dso: t('dso', 'DSO', 'days', 38, 30, 45, true),
  dpo: t('dpo', 'DPO', 'days', 42, 35, 55, false),
  dio: t('dio', 'DIO', 'days', 60, 45, 70, true),
  ccc: t('ccc', 'CCC', 'days', 55, 30, 65, true),
  idleStockShare: t('idleStockShare', 'Harakatsiz zaxira ulushi', 'pct', 5, 0, 10, true),
  planFulfillment: t('planFulfillment', 'Plan bajarilishi', 'pct', 100, 95, 110, false),
}

export function kpiTarget(d: Pick<Dataset, 'kpiTargets'>, key: string): KpiTarget {
  return d.kpiTargets.find((x) => x.key === key) ?? DEFAULT_KPI_TARGETS[key]
}

/** Tannarx o'sishi (PPV, %) chegaralari: ≤5% — normada, ≤10% — diqqat, undan yuqori — xavf. */
export const PPV_LIMITS = { warn: 5, bad: 10 }
export const ppvTone = (pct: number) => (pct <= PPV_LIMITS.warn ? 'good' : pct <= PPV_LIMITS.bad ? 'warn' : 'bad') as 'good' | 'warn' | 'bad'

/** Zaxira ta'minlanganligi: 7 kundan kam — tovar tugash (OOS) xavfi. */
export const OOS_DAYS = 7
/** 180 kundan ortiq harakatsiz — dead stock. */
export const DEAD_STOCK_DAYS = 180
