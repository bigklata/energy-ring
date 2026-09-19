# ADR-0008: Godzinowa rozdzielczość prognozy

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Rynek SDAC używa 15-minutowej MTU od 1 października 2025 roku, dlatego historia danych o tej rozdzielczości jest krótka. Wieloletnie dane godzinowe pozwalają uwzględnić sezonowość i różne warunki rynkowe.

## Decyzja

MVP będzie prognozować średnią cenę oraz zapotrzebowanie dla 24 godzin następnej doby. Nie będzie generować prognoz dla pojedynczych 15-minutowych MTU.

Dane źródłowe zachowają oryginalną rozdzielczość, a dane 15-minutowe będą agregowane do wartości godzinowych na potrzeby modelu.

## Konsekwencje

- Możliwe będzie trenowanie i porównywanie modelu na dłuższej historii.
- Wyniki nie będą bezpośrednią rekomendacją dla pojedynczego produktu 15-minutowego.
- Odświeżanie źródeł co 15 minut pozostaje bez zmian.
- Rozszerzenie do 15 minut będzie wymagało osobnej decyzji i ponownej walidacji modelu.

