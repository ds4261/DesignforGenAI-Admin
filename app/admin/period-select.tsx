'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { periods, type Period } from './period'

export function PeriodSelect({ period, parameter = 'period', label = 'Time period' }: {
    period: Period; parameter?: 'period' | 'activity'; label?: string
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [pending, startTransition] = useTransition()
    return <div className="period-control" aria-busy={pending}>
        <label htmlFor={`${parameter}-period`}>{label}</label>
        <select id={`${parameter}-period`} value={period} disabled={pending} onChange={(event) => {
            const query = new URLSearchParams(searchParams.toString())
            query.set(parameter, event.target.value)
            startTransition(() => router.replace(`/admin?${query}`, { scroll: false }))
        }}>
            {Object.entries(periods).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
        </select>
        <span role="status" className="period-status">{pending ? 'Updating…' : ' '}</span>
    </div>
}
