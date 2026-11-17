:root{--bg:#f6f0e4;--card:#fffaf0;--sage:#a9b79a;--olive:#6b7a4a;--terra:#c4775a;--ink:#3a3a2e;--r:18px}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Georgia,'Times New Roman',serif;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
.wrap{max-width:900px;margin:0 auto;padding:16px 16px 90px}h1,h2{font-weight:500}
.hero{background:linear-gradient(135deg,var(--sage),var(--olive));color:#fff;border-radius:var(--r);padding:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.card{background:var(--card);border-radius:var(--r);box-shadow:0 4px 16px #0001;overflow:hidden;transition:transform .2s;cursor:pointer}.card:hover{transform:translateY(-3px)}
.card .body{padding:12px}.ph{height:150px;background:#e8e0cc;display:flex;align-items:center;justify-content:center;color:#a99;object-fit:cover;width:100%}
button,input,select,textarea{font:inherit;border-radius:12px;border:1px solid #d8cfb8;padding:10px 12px;background:#fff}
button{background:var(--olive);color:#fff;border:0;cursor:pointer;min-height:44px;transition:.2s}button:hover{background:#5a683d}button.alt{background:var(--card);color:var(--ink);border:1px solid #d8cfb8}button.danger{background:var(--terra)}
nav{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--card);border-top:1px solid #e0d6bd;padding-bottom:env(safe-area-inset-bottom)}nav button{flex:1;background:none;color:var(--ink);border-radius:0}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;align-items:center}.toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:var(--olive);color:#fff;padding:10px 18px;border-radius:99px;z-index:9}
.bar{height:6px;background:#e8e0cc;border-radius:9px}.bar i{display:block;height:100%;background:var(--olive);border-radius:9px;transition:width .4s}

import { createClient } from '@supabase/supabase-js'
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

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
