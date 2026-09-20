import { describe, expect, it } from '@jest/globals'
import { importRequestFingerprint, prepareImportSnapshot } from '../../lib/import/snapshot'

const fetched = '2026-09-20T09:00:00.000Z'
function row(end = '2026-09-19 00:15:00', value: number | null = -12.3, published = '2026-09-18 12:00:00') {
  return { business_date: '2026-09-19', dtime_utc: end, csdac_pln: value, publication_ts_utc: published }
}

describe('durable import snapshot identity and acquisition statistics', () => {
  it('keeps null and negative values, UTC publication/fetch times and an honest unaccepted count', () => {
    const snapshot = prepareImportSnapshot([row(), row('2026-09-19 00:30:00', null)], '2026-09-19', fetched)
    expect(snapshot.points.map((x) => x.value)).toEqual([-12.3, null])
    expect(snapshot.points[0].publicationTsUtc).toBe('2026-09-18T12:00:00.000Z')
    expect(snapshot.points[0].fetchedAtUtc).toBe(fetched)
    expect(snapshot.qualitySummary).toEqual({ expectedCount: 96, receivedCount: 2, acceptedCount: 0,
      duplicateCount: 0, missingCount: 94, nullCount: 1, rejectionCodes: ['missing_interval', 'null_required_value'] })
  })
  it.each([['2025-03-30', 92], ['2025-10-26', 100]])('derives the calendar count for %s', (date, expected) => {
    expect(prepareImportSnapshot([], date, fetched).qualitySummary.expectedCount).toBe(expected)
  })
  it('ignores transport ordering and acquisition time when identifying a provider revision', () => {
    const rows = [row(), row('2026-09-19 00:30:00', null)]
    expect(prepareImportSnapshot(rows, '2026-09-19', fetched).providerRevision)
      .toBe(prepareImportSnapshot([...rows].reverse(), '2026-09-19', '2026-09-21T09:00:00.000Z').providerRevision)
  })
  it('detects a change to any point publication timestamp, even below the batch maximum', () => {
    const rows = [row(), row('2026-09-19 00:30:00', 7, '2026-09-19 12:00:00')]
    const changed = [row('2026-09-19 00:15:00', -12.3, '2026-09-18 13:00:00'), rows[1]]
    expect(prepareImportSnapshot(rows, '2026-09-19', fetched).providerRevision)
      .not.toBe(prepareImportSnapshot(changed, '2026-09-19', fetched).providerRevision)
  })
  it('rejects conflicting intervals and dates before anything can be persisted', () => {
    expect(() => prepareImportSnapshot([row(), row()], '2026-09-19', fetched)).toThrow('Conflicting interval')
    expect(() => prepareImportSnapshot([row()], '2026-09-20', fetched)).toThrow('delivery date')
  })
  it('canonicalizes the request and detects changed date, source or cursor', () => {
    const input = { sourceSeriesId: 'source-a', deliveryDate: '2026-09-19', cursor: null, idempotencyKey: 'key-a' }
    const hash = importRequestFingerprint(input)
    expect(importRequestFingerprint({ ...input, idempotencyKey: 'key-b' })).toBe(hash)
    for (const change of [{ deliveryDate: '2026-09-20' }, { sourceSeriesId: 'source-b' }, { cursor: 'cursor' }]) {
      expect(importRequestFingerprint({ ...input, ...change })).not.toBe(hash)
    }
  })
})
