# ADR-0004: Odświeżanie danych co 15 minut

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

System ma prezentować aktualne dane rynkowe i systemowe, ale nie jest systemem sterowania siecią elektroenergetyczną. Publiczne źródła nie dostarczają wszystkich danych z częstotliwością sekundową. Częstotliwość synchronizacji jest niezależna od godzinowej rozdzielczości prognozy.

## Decyzja

MVP będzie automatycznie sprawdzać źródła danych co 15 minut. Import będzie wykonywany w tle przez dedykowany worker modułu Open Mercato.

## Konsekwencje

- Każdy import musi być idempotentny i odporny na powtórzenia.
- Rekord przechowuje czas okresu dostawy, czas publikacji źródła i czas pobrania.
- Awaria źródła nie może usuwać ani nadpisywać wcześniej pobranych danych.
- Interfejs pokazuje czas ostatniej udanej synchronizacji oraz opóźnienie danych.
- Worker ma stały, walidowany kontrakt wejściowy i nie może wykonywać arbitralnych zadań wskazanych przez użytkownika.
