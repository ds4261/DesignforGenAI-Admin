import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
import vm from 'node:vm'

const moduleExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/period.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: moduleExports })
const { parsePeriod, periodStart, inPeriod, activityBuckets } = moduleExports
const now = new Date('2026-10-19T15:30:00.000Z')

test('accepts the four options and defaults invalid query parameters to all time', () => {
    for (const option of ['week', 'month', 'year', 'all']) assert.equal(parsePeriod(option), option)
    for (const option of [undefined, '', 'invalid', '__proto__', ['week', 'month']]) {
        assert.equal(parsePeriod(option), 'all')
    }
})

test('rolling windows use exact UTC boundaries', () => {
    assert.equal(periodStart('week', now), '2026-10-12T15:30:00.000Z')
    assert.equal(periodStart('month', now), '2026-09-19T15:30:00.000Z')
    assert.equal(periodStart('year', now), '2025-10-19T15:30:00.000Z')
    assert.equal(periodStart('all', now), null)
    for (const option of ['week', 'month', 'year']) {
        const start = periodStart(option, now)
        assert.equal(inPeriod(start, option, now), true)
        assert.equal(inPeriod(new Date(Date.parse(start) - 1).toISOString(), option, now), false)
        assert.equal(inPeriod('2026-10-19T15:30:00.001Z', option, now), false)
    }
    assert.equal(inPeriod('2000-01-01T00:00:00Z', 'all', now), true)
    assert.equal(inPeriod('2026-10-12T11:30:00-04:00', 'week', now), true)
})

test('daily chart includes both partial boundary days and filters older and future votes', () => {
    const buckets = activityBuckets('week', now, [
        { created_at: '2026-10-12T15:30:00Z' },
        { created_at: '2026-10-12T15:29:59Z' },
        { created_at: '2026-10-19T15:30:00Z' },
        { created_at: '2026-10-19T15:31:00Z' },
    ])
    assert.equal(buckets.length, 8)
    assert.equal(buckets[0].key, '2026-10-12')
    assert.equal(buckets[0].count, 1)
    assert.equal(buckets.at(-1).count, 1)
    assert.equal(buckets.reduce((sum, b) => sum + b.count, 0), 2)
})

test('year and all time charts preserve vote totals across calendar years', () => {
    const votes = ['2024-12-31T23:59:59Z', '2025-10-19T15:30:00Z', '2026-10-01T00:00:00Z'].map(created_at => ({ created_at }))
    const year = activityBuckets('year', now, votes)
    assert.equal(year[0].key, '2025-10')
    assert.equal(year.reduce((sum, b) => sum + b.count, 0), 2)
    const all = activityBuckets('all', now, votes)
    assert.equal(all[0].key, '2024-12')
    assert.equal(all.reduce((sum, b) => sum + b.count, 0), 3)
})

test('empty periods still produce zero-filled charts without invalid dates', () => {
    for (const period of ['week', 'month', 'year', 'all']) {
        const buckets = activityBuckets(period, now, [])
        assert.ok(buckets.length > 0)
        assert.ok(buckets.every(b => b.count === 0 && !b.label.includes('Invalid')))
    }
})
