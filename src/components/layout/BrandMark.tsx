import { cn } from '@/lib/utils'

/**
 * OSMAN brend belgisi: uchta ochiq orbita, ikkita "sayyora" va oltin yadro (egasi bergan logotip).
 * Rastr o'rniga vektor: chiziqlar `currentColor` oladi — qorong'i temada oq, yorug'ida to'q bo'ladi,
 * yadro esa doim `--gold` tokeni. Shu sabab belgi 20 px dan 96 px gacha bir xil aniq chiqadi.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="OSMAN" className={cn('h-8 w-8 shrink-0 text-txt-primary', className)}>
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        {/* tashqi orbita: yuqoridan chapga va pastga, o'ng tomonda ochiq qoladi */}
        <path d="M14.7 3.67A12.4 12.4 0 1 0 27.05 21.63" />
        {/* o'rta orbita: chapdan tepa orqali o'ngga */}
        <path d="M8.23 11.87A8.8 8.8 0 1 1 22.74 21.66" />
        {/* ichki orbita: yadro atrofidagi qisqa yoy */}
        <path d="M12.04 12.04A5.6 5.6 0 0 0 17.45 21.41" />
      </g>
      <circle cx="27.05" cy="21.63" r="1.55" fill="currentColor" />
      <circle cx="22.74" cy="21.66" r="1.4" fill="currentColor" />
      {/* yadro: var() prezentatsiya atributida hamma joyda ishlamaydi, shuning uchun inline style */}
      <circle cx="16" cy="16" r="3.05" style={{ fill: 'hsl(var(--gold))' }} />
    </svg>
  )
}
