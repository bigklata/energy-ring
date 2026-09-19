# Punkty pomiarowe pozostają poza indeksem zapytań

Pełna historia trzech serii to rząd 240 tys. rekordów, a w Open Mercato każdy zapis encji
objętej indeksem zapytań pociąga zdarzenie reindeksujące. Rejestrujemy w indeksie wyłącznie
`PartiaImportu` (kilkaset rekordów); `PunktPomiarowy` zostaje zwykłą encją bez indeksu.

## Consequences

- Filtrowanie w adminie działa na partiach, a nie na pojedynczych interwałach — co i tak
  jest jedynym filtrowaniem, jakiego potrzebujemy.
- Odpada konieczność pisania ścieżki zapisu masowego (`buildIndexDocument`) — zysk rzędu
  godziny w dziesięciogodzinnym budżecie, przy zerowym koszcie.
- Gdyby kiedyś trzeba było filtrować po pojedynczych punktach, trzeba będzie albo dopisać
  indeks i przebudować go z CLI, albo pisać zapytania wprost do tabeli bazowej.
