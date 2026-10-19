import { connection } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type Caption = { id: string; user_id: string; image_url: string; caption: string; prompt: string; model: string; created_at: string }
type Vote = { caption_id: string; user_id: string; value: number; created_at: string }
type Profile = { id: string; first_name: string | null; last_name: string | null }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
            {children}
        </section>
    )
}

function Bar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
    return (
        <div className="mb-2">
            <div className="flex justify-between text-sm">
                <span className="truncate pr-2">{label}</span>
                <span className="text-gray-500">{note ?? value}</span>
            </div>
            <div className="h-2 rounded bg-gray-100">
                <div className="h-2 rounded bg-black" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
            </div>
        </div>
    )
}

export default async function AdminHome() {
    await connection()
    const supabase = await createClient()

    const [{ data: c }, { data: v }, { data: p }] = await Promise.all([
        supabase.from('captions').select('id,user_id,image_url,caption,prompt,model,created_at').limit(5000),
        supabase.from('caption_votes').select('caption_id,user_id,value,created_at').limit(5000),
        supabase.from('profiles').select('id,first_name,last_name').limit(5000),
    ])
    const captions = (c ?? []) as Caption[]
    const votes = (v ?? []) as Vote[]
    const profiles = (p ?? []) as Profile[]

    const nameOf = (id: string) => {
        const pr = profiles.find((x) => x.id === id)
        return pr ? `${pr.first_name ?? ''} ${pr.last_name ?? ''}`.trim() || 'Unnamed' : 'Unknown'
    }

    // headline numbers
    const ups = votes.filter((x) => x.value > 0).length
    const downs = votes.filter((x) => x.value < 0).length
    const approval = votes.length ? Math.round((ups / votes.length) * 100) : 0

    // per-caption tallies
    const tally = new Map<string, { up: number; down: number }>()
    for (const x of votes) {
        const t = tally.get(x.caption_id) ?? { up: 0, down: 0 }
        if (x.value > 0) t.up++
        else if (x.value < 0) t.down++
        tally.set(x.caption_id, t)
    }
    const scored = captions.map((cap) => {
        const t = tally.get(cap.id) ?? { up: 0, down: 0 }
        const total = t.up + t.down
        return { ...cap, ...t, total, net: t.up - t.down, split: total ? 1 - Math.abs(t.up - t.down) / total : 0 }
    })
    const top = [...scored].sort((a, b) => b.net - a.net).slice(0, 5)
    const controversial = scored.filter((x) => x.total >= 2).sort((a, b) => b.split - a.split || b.total - a.total).slice(0, 5)

    // votes per day, last 14 days
    const days: { day: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push({ day: d.toISOString().slice(0, 10), count: 0 })
    }
    for (const x of votes) {
        const hit = days.find((d) => d.day === x.created_at.slice(0, 10))
        if (hit) hit.count++
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count))

    // models, creators, voters
    const count = <T,>(items: T[], key: (i: T) => string) => {
        const m = new Map<string, number>()
        items.forEach((i) => m.set(key(i), (m.get(key(i)) ?? 0) + 1))
        return [...m.entries()].sort((a, b) => b[1] - a[1])
    }
    const models = count(captions, (x) => x.model || 'unknown')
    const creators = count(captions, (x) => x.user_id).slice(0, 5)
    const voters = count(votes, (x) => x.user_id).slice(0, 5)

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-8">
            <h1 className="text-3xl font-bold">Admin dashboard</h1>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    ['Users', profiles.length],
                    ['AI captions', captions.length],
                    ['Total votes', votes.length],
                    ['Approval rate', `${approval}%`],
                ].map(([label, val]) => (
                    <div key={label as string} className="rounded-xl border p-5">
                        <div className="text-3xl font-bold">{val}</div>
                        <div className="text-sm text-gray-500">{label}</div>
                    </div>
                ))}
            </div>

            <Card title="Votes per day (last 14 days)">
                <div className="flex h-32 items-end gap-1">
                    {days.map((d) => (
                        <div key={d.day} className="flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.count}`}>
                            <div className="w-full rounded-t bg-black" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 4 : 1 }} />
                            <span className="mt-1 text-[10px] text-gray-500">{d.day.slice(8)}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card title="Top rated">
                    {top.map((x) => (
                        <Bar key={x.id} label={x.caption} value={Math.max(x.net, 0)} max={Math.max(1, top[0]?.net ?? 1)} note={`${x.net > 0 ? '+' : ''}${x.net}`} />
                    ))}
                </Card>
                <Card title="Most divisive (closest to a 50/50 split)">
                    {controversial.length === 0 && <p className="text-sm text-gray-500">Needs captions with 2+ votes.</p>}
                    {controversial.map((x) => (
                        <Bar key={x.id} label={x.caption} value={Math.round(x.split * 100)} max={100} note={`▲${x.up} ▼${x.down}`} />
                    ))}
                </Card>
                <Card title="Captions by model">
                    {models.map(([m, n]) => <Bar key={m} label={m} value={n} max={models[0][1]} />)}
                </Card>
                <Card title="Top creators">
                    {creators.map(([id, n]) => <Bar key={id} label={nameOf(id)} value={n} max={creators[0][1]} />)}
                </Card>
                <Card title="Most active voters">
                    {voters.map(([id, n]) => <Bar key={id} label={nameOf(id)} value={n} max={voters[0][1]} />)}
                </Card>
                <Card title="Upvotes vs downvotes">
                    <Bar label="Upvotes" value={ups} max={Math.max(ups, downs, 1)} />
                    <Bar label="Downvotes" value={downs} max={Math.max(ups, downs, 1)} />
                </Card>
            </div>
        </main>
    )
}