export const periods = {
    week: { label: 'Week', days: 7 },
    month: { label: 'Month', days: 30 },
    year: { label: 'Year', days: 365 },
    all: { label: 'All time', days: null },
} as const
export type Period = keyof typeof periods
export function parsePeriod(value: string | string[] | undefined): Period {
    return typeof value === 'string' && Object.hasOwn(periods, value) ? value as Period : 'all'
}
export function periodStart(period: Period, now: Date): string | null {
    const days = periods[period].days
    return days === null ? null : new Date(now.getTime() - days * 86400000).toISOString()
}
export function inPeriod(createdAt: string, period: Period, now: Date): boolean {
    const timestamp = Date.parse(createdAt)
    const start = periodStart(period, now)
    return timestamp <= now.getTime() && (start === null || timestamp >= Date.parse(start))
}

export function activityBuckets(period: Period, now: Date, votes: { created_at: string }[]) {
    votes = votes.filter((vote) => inPeriod(vote.created_at, period, now))
    const monthly = period === 'year' || period === 'all'
    const oldest = votes.reduce((min, vote) => Math.min(min, Date.parse(vote.created_at)), now.getTime())
    const start = monthly
        ? new Date(period === 'all' ? oldest : now.getTime() - 365 * 86400000)
        : new Date(now.getTime() - (periods[period].days ?? 7) * 86400000)
    start.setUTCHours(0, 0, 0, 0)
    if (monthly) start.setUTCDate(1)
    const buckets: { key: string; label: string; count: number }[] = []
    const date = new Date(start)
    while (date <= now) {
        const key = date.toISOString().slice(0, monthly ? 7 : 10)
        buckets.push({ key, label: date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', ...(monthly ? { year: '2-digit' } : { day: 'numeric' }) }), count: 0 })
        if (monthly) date.setUTCMonth(date.getUTCMonth() + 1)
        else date.setUTCDate(date.getUTCDate() + 1)
    }
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
    for (const vote of votes) {
        const bucket = byKey.get(vote.created_at.slice(0, monthly ? 7 : 10))
        if (bucket) bucket.count++
    }
    return buckets
}
