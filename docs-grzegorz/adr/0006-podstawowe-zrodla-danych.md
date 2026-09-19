# ADR-0006: Podstawowe źródła danych

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

MVP wymaga danych o cenach RDN oraz pracy KSE. Dane muszą być dostępne programowo i nadawać się do archiwizacji oraz backtestingu. Warunki wykorzystania danych TGE wymagają oddzielnej analizy licencyjnej.

## Decyzja

Podstawowymi źródłami MVP będą:

- API PSE dla zapotrzebowania, generacji, wymiany transgranicznej i innych danych KSE,
- ENTSO-E Transparency Platform dla cen day-ahead w polskiej strefie cenowej i danych porównawczych.

Bezpośrednie dane TGE nie będą wymagane w MVP. Ich integracja może zostać dodana po potwierdzeniu zakresu licencji i dostępu.

## Konsekwencje

- Każdy rekord musi wskazywać źródło, endpoint i czas pobrania.
- Token ENTSO-E będzie przechowywany jako sekret, poza bazą danych i repozytorium.
- Adaptery źródeł muszą być niezależne, aby awaria jednego źródła nie blokowała pozostałych.
- Zmiana formatu lub endpointu źródła nie może zmieniać historycznych rekordów.

