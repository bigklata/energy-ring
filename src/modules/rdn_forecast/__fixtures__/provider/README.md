# Raw PSE provider responses

These JSON files are the response bodies returned by `https://api.raporty.pse.pl/api/`
on 2026-09-19 at approximately 14:04 UTC. The responses were parsed and
reserialized as indented JSON; field names, values, row order, envelope keys,
and the `nextLink` were preserved. No test needs PSE access.

| Files | Source request | Evidence |
| --- | --- | --- |
| `csdac-pln-2026-05-01-to-2026-05-02-page-{1,2}.json` | [range request](https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date+ge+%272026-05-01%27+and+business_date+le+%272026-05-02%27); page 2 uses page 1's exact `nextLink` | 100 + 92 rows, genuine `$after` cursor, negative prices including -2086.86 PLN/MWh |
| `kse-load-2024-06-13-null.json` | [day request](https://api.raporty.pse.pl/api/kse-load?%24filter=business_date+eq+%272024-06-13%27) | One returned row with `load_fcst: null` and `load_actual: 16383.22` |
| `pk5l-wp-2025-10-26.json` | [day request](https://api.raporty.pse.pl/api/pk5l-wp?%24filter=business_date+eq+%272025-10-26%27) | 25 source hours, including the repeated local hour |
| `csdac-pln-2025-03-30.json` | [day request](https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date+eq+%272025-03-30%27) | 92 MTU on the spring clock change |
| `csdac-pln-2025-10-26.json` | [day request](https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date+eq+%272025-10-26%27) | 100 MTU on the autumn clock change |

The range request's first response contains the exact PSE `nextLink`, including
its `$after` token. The second file is the response to that link. The separate
contract fixture in `docs/fixtures/rdn/provider-paginated-revision.json` describes
a synthetic revision scenario. These raw responses map to its page/row *shape*;
they do not claim that PSE returned the synthetic revision values.
