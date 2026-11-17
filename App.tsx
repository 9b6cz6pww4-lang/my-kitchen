import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb } from './supabase'
import { matchRecipe, scale, type Ing, type Fridge } from './match'

type Recipe = { id: string; title: string; description: string; category: string; ingredients: Ing[]; steps: string[]; servings: number; prep_min: number; cook_min: number; difficulty: string; notes: string; favorite: boolean; photos: string[] }
const UNITS = ['г', 'кг', 'мл', 'л', 'шт.', 'ст. л.', 'ч. л.', 'по вкусу']
const CATS = ['Завтраки', 'Обеды', 'Ужины', 'Супы', 'Салаты', 'Мясные блюда', 'Рыбные блюда', 'Гарниры', 'Выпечка', 'Десерты', 'Соусы', 'Закуски', 'Напитки']
const blank = () => ({ title: '', description: '', category: 'Ужины', ingredients: [{ name: '', qty: null, unit: 'г' }] as Ing[], steps: [''], servings: 2, prep_min: 10, cook_min: 20, difficulty: 'Легко', notes: '', photos: [] as string[] })

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <div className="wrap">Загрузка…</div>
  return session ? <Main uid={session.user.id} /> : <Auth />
}

function Auth() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [mode, setMode] = useState<'in' | 'up'>('in'), [err, setErr] = useState('')
  const go = async () => {
    setErr('')
    const { error } = mode === 'in' ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw })
    if (error) setErr(error.message); else if (mode === 'up') setErr('Проверьте почту: нужно подтвердить адрес.')
  }
  return <div className="wrap"><div className="hero"><h1>My Kitchen</h1><p>Твоя кухня. Твои рецепты. Твоё вдохновение</p></div>
    <div className="row"><input placeholder="Электронная почта" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Пароль (от 6 символов)" value={pw} onChange={e => setPw(e.target.value)} />
      <button onClick={go}>{mode === 'in' ? 'Войти' : 'Зарегистрироваться'}</button>
      <button className="alt" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Создать аккаунт' : 'Уже есть аккаунт'}</button></div>
    {err && <p>{err}</p>}</div>
}

function Main({ uid }: { uid: string }) {
  const [tab, setTab] = useState<'home' | 'book' | 'fridge' | 'add'>('home')
  const [recipes, setRecipes] = useState<Recipe[]>([]), [fridge, setFridge] = useState<Fridge[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({}), [toast, setToast] = useState(''), [editing, setEditing] = useState<any>(null)
  const [q, setQ] = useState(''), [results, setResults] = useState<any[] | null>(null), [open, setOpen] = useState<Recipe | null>(null), [people, setPeople] = useState(1)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = async () => {
    const r = await sb.from('recipes').select('*').order('created_at', { ascending: false })
    if (r.error) return say('Не удалось загрузить рецепты: ' + r.error.message)
    const list = r.data as Recipe[]; setRecipes(list)
    const f = await sb.from('fridge_items').select('name,qty,unit'); if (f.data) setFridge(f.data as Fridge[])
    const paths = list.flatMap(x => x.photos)
    if (paths.length) { const s = await sb.storage.from('photos').createSignedUrls(paths, 3600); const m: Record<string, string> = {}; s.data?.forEach(d => { if (d.path && d.signedUrl) m[d.path] = d.signedUrl }); setUrls(m) }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    const e = editing
    if (!e.title.trim()) return say('Введите название блюда')
    const ings = e.ingredients.filter((i: Ing) => i.name.trim())
    if (!ings.length) return say('Добавьте хотя бы один ингредиент')
    const { id, created_at, user_id, ...rest } = e
    const row = { ...rest, ingredients: ings, steps: e.steps.filter((s: string) => s.trim()), updated_at: new Date().toISOString() }
    const { error } = id ? await sb.from('recipes').update(row).eq('id', id) : await sb.from('recipes').insert(row)
    if (error) return say('Ошибка сохранения: ' + error.message)
    say('Рецепт сохранён'); setEditing(null); setTab('book'); load()
  }
  const upload = async (files: FileList | null) => {
    if (!files) return
    const paths: string[] = []
    for (const f of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { say('Поддерживаются JPG, PNG и WEBP'); continue }
      const p = `${uid}/${crypto.randomUUID()}.${f.type.split('/')[1]}`
      const { error } = await sb.storage.from('photos').upload(p, f)
      if (error) say('Не удалось загрузить фото: ' + error.message); else paths.push(p)
    }
    setEditing((e: any) => ({ ...e, photos: [...e.photos, ...paths] }))
  }
  const del = async (r: Recipe) => { if (!confirm(`Удалить «${r.title}»? Это действие нельзя отменить.`)) return; await sb.from('recipes').delete().eq('id', r.id); say('Рецепт удалён'); setOpen(null); load() }
  const fav = async (r: Recipe) => { await sb.from('recipes').update({ favorite: !r.favorite }).eq('id', r.id); load() }
  const cooked = async (r: Recipe) => { await sb.from('cook_history').insert({ recipe_id: r.id, title: r.title }); say('Записано в историю') }
  const saveFridge = async () => {
    const rows = fridge.filter(f => f.name.trim()).map(f => ({ name: f.name, qty: f.qty, unit: f.unit }))
    await sb.from('fridge_items').delete().eq('user_id', uid)
    if (rows.length) await sb.from('fridge_items').insert(rows)
    setResults(recipes.map(r => ({ r, m: matchRecipe(r.ingredients, rows) })).sort((a, b) => b.m.pct - a.m.pct)); say('Список сохранён')
  }
  const setF = (k: number, p: Partial<Fridge>) => setFridge(fridge.map((x, j) => j === k ? { ...x, ...p } : x))
  const setI = (k: number, p: Partial<Ing>) => setEditing({ ...editing, ingredients: editing.ingredients.map((x: Ing, j: number) => j === k ? { ...x, ...p } : x) })
  const num = (v: string) => v === '' ? null : +v
  const Card = ({ r, extra }: { r: Recipe; extra?: any }) => <div className="card" onClick={() => { setOpen(r); setPeople(r.servings) }}>
    {r.photos[0] && urls[r.photos[0]] ? <img className="ph" src={urls[r.photos[0]]} alt={r.title} /> : <div className="ph">Нет фото</div>}
    <div className="body"><b>{r.title}</b><div>{r.prep_min + r.cook_min} мин · {r.difficulty} · {r.servings} порц.</div>{extra}
      <button className="alt" onClick={e => { e.stopPropagation(); fav(r) }}>{r.favorite ? '♥ В избранном' : '♡ В избранное'}</button></div></div>

  if (open) { const r = open; return <div className="wrap"><button className="alt" onClick={() => setOpen(null)}>← Назад</button>
    {r.photos.map(p => urls[p] && <img key={p} className="ph" style={{ height: 240, marginTop: 8 }} src={urls[p]} />)}
    <h1>{r.title}</h1><p>{r.description}</p><p>Подготовка {r.prep_min} мин · Готовка {r.cook_min} мин · Всего {r.prep_min + r.cook_min} мин · {r.difficulty}</p>
    <div className="row">Порций: <input type="number" min={1} value={people} onChange={e => setPeople(+e.target.value || 1)} style={{ width: 80 }} /></div>
    <h2>Ингредиенты</h2><ul>{r.ingredients.map((i, k) => <li key={k}>{i.name} — {i.unit === 'по вкусу' ? 'по вкусу' : `${scale(i.qty, r.servings, people) ?? ''} ${i.unit}`}</li>)}</ul>
    <h2>Приготовление</h2><ol>{r.steps.map((s, k) => <li key={k} style={{ fontSize: 18, marginBottom: 10 }}>{s}</li>)}</ol>
    {r.notes && <><h2>Заметки</h2><p>{r.notes}</p></>}
    <div className="row"><button onClick={() => cooked(r)}>Блюдо приготовлено</button><button className="alt" onClick={() => { setEditing(r); setOpen(null); setTab('add') }}>Редактировать</button><button className="danger" onClick={() => del(r)}>Удалить</button></div>
    {toast && <div className="toast">{toast}</div>}</div> }

  const shown = recipes.filter(r => (r.title + ' ' + r.ingredients.map(i => i.name).join(' ')).toLowerCase().includes(q.toLowerCase()))
  return <div className="wrap">{toast && <div className="toast">{toast}</div>}
    {tab === 'home' && <><div className="hero"><h1>My Kitchen</h1><p>Твоя кухня. Твои рецепты. Твоё вдохновение</p><h2>Что сегодня приготовим?</h2>
      <div className="row"><button className="alt" onClick={() => setTab('book')}>Мои рецепты</button><button className="alt" onClick={() => setTab('fridge')}>Что есть в холодильнике?</button><button className="alt" onClick={() => { setEditing(blank()); setTab('add') }}>Добавить рецепт</button></div></div>
      <p>Сохранено рецептов: {recipes.length}</p><h2>Любимые блюда</h2>
      {recipes.some(r => r.favorite) ? <div className="grid">{recipes.filter(r => r.favorite).map(r => <Card key={r.id} r={r} />)}</div> : <p>Пока нет избранных блюд.</p>}
      <h2>Быстрые рецепты (до 30 минут)</h2><div className="grid">{recipes.filter(r => r.prep_min + r.cook_min <= 30).slice(0, 6).map(r => <Card key={r.id} r={r} />)}</div></>}
    {tab === 'book' && <><h1>Мои рецепты</h1><input placeholder="Поиск по названию или ингредиенту" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%' }} />
      {shown.length ? <div className="grid" style={{ marginTop: 12 }}>{shown.map(r => <Card key={r.id} r={r} />)}</div> : <p>Рецептов пока нет. Добавьте первый!</p>}</>}
    {tab === 'fridge' && <><h1>Что есть в холодильнике?</h1>
      {fridge.map((f, k) => <div className="row" key={k}><input placeholder="Продукт" value={f.name} onChange={e => setF(k, { name: e.target.value })} />
        <input type="number" placeholder="Кол-во" style={{ width: 90 }} value={f.qty ?? ''} onChange={e => setF(k, { qty: num(e.target.value) })} />
        <select value={f.unit} onChange={e => setF(k, { unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
        <button className="alt" onClick={() => setFridge(fridge.filter((_, j) => j !== k))}>✕</button></div>)}
      <div className="row"><button className="alt" onClick={() => setFridge([...fridge, { name: '', qty: null, unit: 'г' }])}>+ Добавить продукт</button><button onClick={saveFridge}>Найти, что приготовить</button></div>
      {results && [[1, 'Можно приготовить сейчас'], [2, 'Почти готово'], [3, 'Потребуется докупить']].map(([g, t]) => <div key={g as number}><h2>{t}</h2>
        {results.filter(x => x.m.group === g).length ? <div className="grid">{results.filter(x => x.m.group === g).map(x => <Card key={x.r.id} r={x.r} extra={<><div className="bar"><i style={{ width: x.m.pct + '%' }} /></div><small>Совпадение {x.m.pct}%</small>
          {x.m.lack.length > 0 && <div>Не хватает: {x.m.lack.join(', ')}</div>}</>} />)}</div> : <p>Здесь пока пусто.</p>}</div>)}</>}
    {tab === 'add' && editing && <><h1>{editing.id ? 'Редактирование' : 'Новый рецепт'}</h1>
      <div className="row"><input placeholder="Название блюда" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} style={{ flex: 1 }} />
        <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
      <textarea placeholder="Краткое описание" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} style={{ width: '100%' }} />
      <h2>Ингредиенты</h2>{editing.ingredients.map((i: Ing, k: number) => <div className="row" key={k}>
        <input placeholder="Продукт" value={i.name} onChange={e => setI(k, { name: e.target.value })} />
        <input type="number" placeholder="Кол-во" style={{ width: 90 }} value={i.qty ?? ''} onChange={e => setI(k, { qty: num(e.target.value) })} />
        <select value={i.unit} onChange={e => setI(k, { unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
        <button className="alt" onClick={() => setEditing({ ...editing, ingredients: editing.ingredients.filter((_: any, j: number) => j !== k) })}>✕</button></div>)}
      <button className="alt" onClick={() => setEditing({ ...editing, ingredients: [...editing.ingredients, { name: '', qty: null, unit: 'г' }] })}>+ Ингредиент</button>
      <div className="row">Порций <input type="number" min={1} style={{ width: 70 }} value={editing.servings} onChange={e => setEditing({ ...editing, servings: +e.target.value || 1 })} />
        Подготовка, мин <input type="number" style={{ width: 80 }} value={editing.prep_min} onChange={e => setEditing({ ...editing, prep_min: +e.target.value })} />
        Готовка, мин <input type="number" style={{ width: 80 }} value={editing.cook_min} onChange={e => setEditing({ ...editing, cook_min: +e.target.value })} />
        <select value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: e.target.value })}>{['Легко', 'Средне', 'Сложно'].map(d => <option key={d}>{d}</option>)}</select></div>
      <h2>Шаги</h2>{editing.steps.map((s: string, k: number) => <textarea key={k} placeholder={`Шаг ${k + 1}`} value={s} style={{ width: '100%', marginBottom: 6 }} onChange={e => setEditing({ ...editing, steps: editing.steps.map((x: string, j: number) => j === k ? e.target.value : x) })} />)}
      <button className="alt" onClick={() => setEditing({ ...editing, steps: [...editing.steps, ''] })}>+ Шаг</button>
      <textarea placeholder="Личные заметки и секреты" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} style={{ width: '100%', marginTop: 8 }} />
      <h2>Фотографии</h2><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => upload(e.target.files)} />
      <p>Загружено фото: {editing.photos.length}</p>
      <div className="row"><button onClick={save}>Сохранить рецепт</button><button className="alt" onClick={() => { setEditing(null); setTab('book') }}>Отмена</button></div></>}
    <nav>{([['home', 'Главная'], ['book', 'Рецепты'], ['fridge', 'Холодильник'], ['add', 'Добавить']] as const).map(([k, t]) =>
      <button key={k} onClick={() => { if (k === 'add' && !editing) setEditing(blank()); setTab(k) }}>{t}</button>)}
      <button onClick={() => sb.auth.signOut()}>Выйти</button></nav></div>
}
