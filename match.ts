export type Ing = { name: string; qty: number | null; unit: string }
export type Fridge = { name: string; qty: number | null; unit: string }
const SYN: Record<string, string> = { картошк: 'картофел', помидор: 'томат', куриц: 'курин' }
export function norm(s: string) {
  const w = s.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9 ]/g, ' ').trim().replace(/\s+/g, ' ')
  return w.split(' ').map(x => { if (x.length > 4) x = x.replace(/(ами|ями|ов|ев|ей|ой|ом|ах|ях|ы|и|а|я|у|ю|е|о)$/, ''); return SYN[x] ?? x }).join(' ')
}
function base(q: number | null, u: string): [number | null, string] {
  if (q == null) return [null, u]
  if (u === 'кг') return [q * 1000, 'г']
  if (u === 'л') return [q * 1000, 'мл']
  return [q, u]
}
export function matchRecipe(ings: Ing[], fridge: Fridge[]) {
  const need = ings.filter(i => i.unit !== 'по вкусу')
  const have: string[] = [], lack: string[] = []
  for (const i of need) {
    const f = fridge.find(x => norm(x.name) === norm(i.name))
    if (!f) { lack.push(i.name); continue }
    const [rq, ru] = base(i.qty, i.unit), [fq, fu] = base(f.qty, f.unit)
    if (rq == null || fq == null || ru !== fu) { have.push(i.name); continue }
    if (fq >= rq) have.push(i.name); else lack.push(`${i.name} (нужно ещё ${rq - fq} ${ru})`)
  }
  const pct = need.length ? Math.round(have.length / need.length * 100) : 0
  return { have, lack, pct, group: lack.length === 0 ? 1 : lack.length <= 2 ? 2 : 3 }
}
export const scale = (q: number | null, from: number, to: number) => q == null ? null : Math.round(q * to / from * 100) / 100
