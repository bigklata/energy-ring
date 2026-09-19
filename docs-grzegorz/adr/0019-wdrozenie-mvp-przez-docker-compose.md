# ADR-0019: Wdrożenie MVP przez Docker Compose

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

MVP składa się z aplikacji Open Mercato, procesów worker, serwisu Python ML, PostgreSQL i Redis. Kubernetes oraz wysoka dostępność zwiększyłyby koszt operacyjny bez potwierdzonej potrzeby.

## Decyzja

Środowisko lokalne i pierwsze wdrożenie na pojedynczym VPS będą uruchamiane przez Docker Compose.

Sekrety, w tym token ENTSO-E i dane uwierzytelniające komunikacji między usługami, będą przekazywane przez zmienne środowiskowe albo system sekretów. Nie będą przechowywane w repozytorium ani bazie jako jawny tekst.

## Konsekwencje

- MVP nie gwarantuje wysokiej dostępności.
- Wolumeny PostgreSQL i artefaktów muszą być trwałe oraz objęte kopią zapasową.
- Usługi otrzymają health checks, limity zasobów i kontrolowaną kolejność startu.
- Przejście na orkiestrację wielowęzłową wymaga osobnej decyzji popartej wymaganiami obciążenia lub dostępności.

