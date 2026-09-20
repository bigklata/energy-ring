import { describe, expect, it, jest } from '@jest/globals'
import { PseClient, type PseFetchLike } from '../../integrations/pse'

function page(value: unknown[], nextLink: string | null = null) {
  return { ok: true, status: 200, json: async () => ({ value, nextLink }) }
}

describe('bounded import provider pagination', () => {
  it('resumes only an allowlisted cursor for the selected endpoint', async () => {
    const fetchImpl = jest.fn<PseFetchLike>().mockResolvedValue(page([{ id: 2 }]))
    const client = new PseClient({ fetchImpl })
    const cursor = 'https://api.raporty.pse.pl/api/csdac-pln?cursor=page2'
    expect(await client.getAll({ endpoint: 'csdac-pln', initialCursor: cursor, maxItems: 3 })).toEqual([{ id: 2 }])
    expect(fetchImpl.mock.calls[0][0]).toBe(cursor)
    await expect(client.getAll({ endpoint: 'csdac-pln', initialCursor: 'https://api.raporty.pse.pl/api/kse-load' }))
      .rejects.toMatchObject({ code: 'host_not_allowed' })
    await expect(client.getAll({ endpoint: 'csdac-pln', initialCursor: 'http://localhost/secret' }))
      .rejects.toMatchObject({ code: 'host_not_allowed' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('fails before exceeding the bounded accumulated snapshot size', async () => {
    const fetchImpl = jest.fn<PseFetchLike>().mockResolvedValue(page([{ id: 1 }, { id: 2 }]))
    await expect(new PseClient({ fetchImpl }).getAll({ endpoint: 'csdac-pln', maxItems: 1 }))
      .rejects.toMatchObject({ code: 'invalid_response' })
  })
})
