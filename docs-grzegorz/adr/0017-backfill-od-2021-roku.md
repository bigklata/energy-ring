# ADR-0017: Backfill od 2021 roku

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Model godzinowy potrzebuje kilku pełnych cykli sezonowych oraz przykładów różnych warunków rynkowych. Jednocześnie bardzo stare dane mogą słabo reprezentować współczesną strukturę rynku i udział OZE.

## Decyzja

Pierwszy backfill obejmie dane od 1 stycznia 2021 roku do chwili uruchomienia systemu.

Każda seria otrzyma raport pokrycia wskazujący dostępny zakres, luki i zmiany rozdzielczości. Brakujące wartości nie będą uzupełniane bez jawnej, wersjonowanej reguły transformacji.

## Konsekwencje

- Trening nie musi czekać na import starszych danych.
- Okres obejmie kilka sezonów oraz zdarzenia skrajne na rynku energii.
- Dane sprzed 2021 roku pozostają opcjonalnym rozszerzeniem badawczym.
- Backfill musi być wznawialny i idempotentny.

