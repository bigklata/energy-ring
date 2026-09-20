import { createHash } from 'node:crypto'
import { listDeliveryDayIntervals } from '../../components/evaluation/warsawTime'
import { parseCsdacPlnRow, type CsdacPlnTargetPoint } from '../../integrations/data-sync'
import type { RdnImportCommandInput } from '../../commands/schemas'
import type { RdnQualitySummary } from '../../data/entities'

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function importRequestFingerprint(input: RdnImportCommandInput): string {
  return fingerprint([input.sourceSeriesId, input.deliveryDate, input.cursor])
}

export type ImportSnapshot = {
  points: CsdacPlnTargetPoint[]
  providerRevision: string
  qualitySummary: RdnQualitySummary
}

/** Acquisition statistics only. Acceptance and rejection policy belongs to #27. */
export function prepareImportSnapshot(rows: unknown[], deliveryDate: string, fetchedAtUtc: string): ImportSnapshot {
  const expected = listDeliveryDayIntervals(deliveryDate)
  if (!expected.length || rows.length > 10_000) throw new Error('Invalid import snapshot size or date')
  const points = rows.map((row) => parseCsdacPlnRow(row, fetchedAtUtc))
    .sort((a, b) => a.providerKey.localeCompare(b.providerKey))
  const intervals = new Set<string>()
  for (const point of points) {
    if (point.businessDate !== deliveryDate || intervals.has(point.intervalStartUtc)) {
      throw new Error('Conflicting interval or delivery date in import snapshot')
    }
    intervals.add(point.intervalStartUtc)
  }
  const missingCount = expected.filter((x) => !intervals.has(x.startUtc)).length
  const nullCount = points.filter((x) => x.value === null).length
  return {
    points,
    providerRevision: fingerprint(points.map((x) => [x.providerKey, x.publicationTsUtc, x.value, x.unit])),
    qualitySummary: {
      expectedCount: expected.length, receivedCount: points.length, acceptedCount: 0,
      duplicateCount: 0, missingCount, nullCount,
      rejectionCodes: [
        ...(missingCount ? ['missing_interval'] : []),
        ...(nullCount ? ['null_required_value'] : []),
      ].sort(),
    },
  }
}
