# ADR-0005: PostgreSQL jako magazyn danych MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Dane rynkowe i systemowe będą pobierane co 15 minut. Pojedyncza seria o tej rozdzielczości tworzy około 35 tysięcy rekordów rocznie. Dodanie osobnej bazy time-series zwiększyłoby złożoność wdrożenia i utrzymania.

## Decyzja

MVP będzie przechowywać dane źródłowe, prognozy, scenariusze i wyniki backtestingu w PostgreSQL używanym przez Open Mercato.

Osobna baza time-series ani rozszerzenie TimescaleDB nie będą wymagane w MVP.

## Konsekwencje

- Dane będą należeć do dedykowanego modułu Open Mercato i jego migracji.
- Indeksy oraz klucze unikalne muszą wspierać zapytania po źródle, rodzaju wskaźnika i okresie dostawy.
- Surowe wartości źródłowe pozostają niezmienne; korekty źródła są zapisywane jako kolejne wersje.
- Decyzja zostanie ponownie oceniona dopiero po pomiarach wskazujących problem z wydajnością, retencją lub agregacją danych.

