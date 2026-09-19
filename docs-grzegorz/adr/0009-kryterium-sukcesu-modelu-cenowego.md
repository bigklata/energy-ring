# ADR-0009: Kryterium sukcesu modelu cenowego

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

MVP wymaga mierzalnego sposobu oceny, czy model wnosi wartość ponad prostą prognozę opartą na historii. Ceny energii mogą być zerowe lub ujemne, dlatego metryki procentowe mogą dawać wyniki trudne do interpretacji.

## Decyzja

Główną metryką modelu cenowego będzie MAE wyrażone w PLN/MWh. Model zostanie porównany z dwoma modelami bazowymi:

- ceną odpowiadającej godziny poprzedniego dnia,
- ceną odpowiadającej godziny poprzedniego tygodnia.

Warunkiem sukcesu MVP jest uzyskanie w kroczącym backtestingu MAE co najmniej 10% niższego od lepszego modelu bazowego.

## Konsekwencje

- Podział danych musi zachowywać kolejność czasową.
- Wynik będzie raportowany łącznie oraz oddzielnie dla godzin szczytowych i skoków cen.
- MAPE nie będzie używane jako główna metryka ceny.
- Każdy wynik musi wskazywać wersję modelu, okres testowy i zestaw użytych cech.

