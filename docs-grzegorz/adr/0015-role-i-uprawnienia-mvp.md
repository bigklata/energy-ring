# ADR-0015: Role i uprawnienia MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

MVP nie wykonuje transakcji, ale udostępnia dane platformowe, scenariusze tenantowe oraz operacje administracyjne. Uprawnienia muszą oddzielać analizę od zarządzania źródłami i modelami.

## Decyzja

MVP będzie posiadać cztery zestawy ról:

- Viewer: odczyt danych, prognoz i udostępnionych wyników,
- Analyst: uprawnienia Viewer oraz zarządzanie scenariuszami i uruchamianie symulacji oraz backtestingu,
- Tenant Admin: zarządzanie użytkownikami i ustawieniami własnego tenantu,
- Platform Admin: zarządzanie źródłami danych, treningami, modelami i zadaniami platformowymi.

Nie powstanie rola Trader, ponieważ system nie składa zleceń.

## Konsekwencje

- API i strony muszą sprawdzać feature-based RBAC po stronie serwera.
- Tenant Admin nie może zarządzać globalnymi źródłami ani modelami.
- Analyst nie może aktywować wersji modelu ani zmieniać konfiguracji źródeł.
- Domyślne role będą zbiorem funkcji, a nie warunkami zaszytymi w kodzie biznesowym.

