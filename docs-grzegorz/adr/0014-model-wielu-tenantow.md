# ADR-0014: Model wielu tenantów

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Platforma ma docelowo obsługiwać wiele firm energetycznych. Dane rynkowe PSE, ENTSO-E i pogodowe są wspólne dla wszystkich firm, natomiast scenariusze portfela, symulacje i ustawienia należą do konkretnego klienta.

## Decyzja

MVP wykorzysta natywne multi-tenancy i RBAC Open Mercato.

- Dane źródłowe, wersje modeli i publiczne prognozy rynkowe będą zasobami platformowymi, tylko do odczytu dla tenantów.
- Scenariusze portfela, uruchomienia symulacji i ich wyniki będą posiadać `tenant_id` oraz `organization_id`.
- Dane platformowe może zapisywać wyłącznie systemowy worker albo platform admin.
- Zakres tenant i organization będzie wyprowadzany z uwierzytelnionego kontekstu, nigdy z identyfikatora przesłanego przez użytkownika.

## Konsekwencje

- Dane platformowe otrzymają dedykowane API zamiast ogólnego CRUD dostępnego dla tenantów.
- Każde zapytanie do danych klienta musi filtrować po tenant i organization po stronie serwera.
- Identyfikator zasobu z innego tenantu nie może ujawniać jego istnienia.
- Testy integracyjne muszą obejmować próby odczytu i modyfikacji między tenantami.
- Klucze cache, zadania kolejki i logi audytowe muszą zawierać bezpiecznie wyprowadzony zakres tenantowy.

