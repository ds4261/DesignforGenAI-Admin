import { PeriodSelect } from './period-select'
import { activityBuckets, inPeriod, parsePeriod, periodStart, periods } from './period'
import { connection } from 'next/server'
import { requireAdmin } from '@/utils/supabase/admin'

type Caption = { id: string; user_id: string; caption: string; model: string; created_at: string }
type Vote = { caption_id: string; user_id: string; value: number; created_at: string }
type Profile = { id: string; first_name: string | null; last_name: string | null }

function Card({ title, children, controls }: { title: string; children: React.ReactNode; controls?: React.ReactNode }) {
    return (
        <section className="dashboard-card">
            <div className="card-header"><h2 className="card-heading">{title}</h2>{controls}</div>
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
            <div className="chart-track">
                <div className="chart-fill" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
            </div>
        </div>
    )
}

export default async function AdminHome({ searchParams }: {
    searchParams: Promise<{ activity?: string | string[] }>
}) {
    await connection()
    const { supabase } = await requireAdmin()

    const params = await searchParams
    const activityPeriod = parsePeriod(params.activity)
    const now = new Date()
    const activitySince = periodStart(activityPeriod, now)
    // Read in pages rather than silently truncating statistics at Supabase's row limit.
    async function readMedia() {
        const rows: Caption[] = []
        for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from('nyc_caption_media')
                .select('id,user_id,captions,model,created_at').lte('created_at', now.toISOString())
                .order('created_at').order('id').range(offset, offset + 499)
            if (error) throw new Error('Unable to load dashboard media.')
            rows.push(...data.map((row) => ({ ...row, caption: (row.captions as string[]).join(' / ') })))
            if (data.length < 500) return rows
        }
    }
    async function readVotes() {
        const rows: Vote[] = []
        for (let offset = 0; ; offset += 500) {
            const query = supabase.from('nyc_caption_votes')
                .select('media_id,user_id,direction,created_at,caption_index')
                .lte('created_at', now.toISOString())
                .order('created_at').order('media_id').order('caption_index').order('user_id')
                .range(offset, offset + 499)
            const { data, error } = await query
            if (error) throw new Error('Unable to load dashboard votes.')
            rows.push(...data.map((row) => ({ ...row, caption_id: row.media_id, value: row.direction })))
            if (data.length < 500) return rows
        }
    }
    async function readProfiles() {
        const rows: Profile[] = []
        for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from('profiles')
                .select('id,first_name,last_name').order('id').range(offset, offset + 499)
            if (error) throw new Error('Unable to load dashboard profiles.')
            rows.push(...data)
            if (data.length < 500) return rows
        }
    }
    const [allMedia, fetchedVotes, profiles] = await Promise.all([readMedia(), readVotes(), readProfiles()])
    const votes = fetchedVotes
    const activityVotes = fetchedVotes.filter((vote) => inPeriod(vote.created_at, activityPeriod, now))
    const captions = allMedia

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
    const scored = allMedia.filter((cap) => tally.has(cap.id)).map((cap) => {
        const t = tally.get(cap.id) ?? { up: 0, down: 0 }
        const total = t.up + t.down
        return { ...cap, ...t, total, net: t.up - t.down, split: total ? 1 - Math.abs(t.up - t.down) / total : 0 }
    })
    const top = [...scored].sort((a, b) => b.net - a.net).slice(0, 5)
    const controversial = scored.filter((x) => x.total >= 2).sort((a, b) => b.split - a.split || b.total - a.total).slice(0, 5)

    const days = activityBuckets(activityPeriod, now, activityVotes)
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
        <main className="admin-page space-y-8">
            <header className="dashboard-header">
                <div className="page-intro">
                    <span className="subway-badge" aria-hidden="true">A</span>
                    <div><p className="eyebrow">BOROUGH / ADMIN</p>
                        <h1>Admin dashboard</h1>
                        <p className="page-description">The city’s photos, captions, and community at a glance.</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    ['Total users', profiles.length],
                    ['Media created', captions.length],
                    ['Total votes', votes.length],
                    ['Approval rate', `${approval}%`],
                ].map(([label, val]) => (
                    <div key={label as string} className="dashboard-card stat-card">
                        <div className="stat-value">{val}</div>
                        <div className="text-sm text-gray-500">{label}</div>
                    </div>
                ))}
            </div>

            <Card title="Voting activity" controls={<PeriodSelect period={activityPeriod} parameter="activity" label="View by" />}>
                <p className="data-note">{activitySince ? `Past ${periods[activityPeriod].days} days` : 'All recorded votes'} · {activityPeriod === 'year' || activityPeriod === 'all' ? 'Monthly' : 'Daily'} totals · UTC</p>
                {activityVotes.length === 0 && <p className="empty-note">No votes in this period yet.</p>}
                <div className="activity-chart">
                    {days.map((d) => (
                        <div key={d.key} className="activity-column" title={`${d.label}: ${d.count} votes`}>
                            <div className="activity-bar" style={{ height: `${(d.count / maxDay) * 120}px`, minHeight: d.count ? 4 : 1 }} />
                            <span className="mt-1 text-[10px] text-gray-500">{d.label}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card title="Top rated media">
                    {top.length === 0 && <p className="empty-note">No rated media in this period.</p>}
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
                <Card title="Media by model">
                    {models.length === 0 && <p className="empty-note">No media created in this period.</p>}
                    {models.map(([m, n]) => <Bar key={m} label={m} value={n} max={models[0][1]} />)}
                </Card>
                <Card title="Top creators">
                    {creators.length === 0 && <p className="empty-note">No creators in this period.</p>}
                    {creators.map(([id, n]) => <Bar key={id} label={nameOf(id)} value={n} max={creators[0][1]} />)}
                </Card>
                <Card title="Most active voters">
                    {voters.length === 0 && <p className="empty-note">No voters in this period.</p>}
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
