# ADR-0012: Codzienny trening modelu

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Rynek energii zmienia się wraz z pogodą, zapotrzebowaniem, dostępnością generacji i sytuacją transgraniczną. Użytkownik preferuje codzienną aktualizację modelu zamiast treningu tygodniowego.

## Decyzja

Raz dziennie, po zaimportowaniu najnowszych kompletnych wyników, serwis ML wytrenuje nowego kandydata modelu i wykona backtesting.

Kandydat zostanie aktywowany tylko wtedy, gdy spełni kryterium ADR-0009 i nie pogorszy zatwierdzonych testów jakości względem aktualnego modelu. Administrator będzie mógł uruchomić trening ręcznie.

## Konsekwencje

- Nieudany trening nie wyłącza aktualnego modelu.
- Każdy kandydat otrzymuje własną wersję, metryki i status aktywacji lub odrzucenia.
- Trening i inferencja są oddzielnymi zadaniami.
- System przechowuje powód odrzucenia kandydata oraz pozwala wskazać poprzednią wersję jako aktywną.

