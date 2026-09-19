# ADR-0003: Analityczny charakter MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Pełne pokrycie zapotrzebowania wyłącznie na RDN nie pozostawia alternatywnego momentu ani rynku zakupu. Prognoza ceny nie może więc sama wykazać obniżenia kosztu zakupu.

## Decyzja

MVP będzie systemem analityczno-prognostycznym. Będzie prognozować ceny i zapotrzebowanie, symulować rekomendacje dla portfela oraz porównywać wyniki z modelem bazowym.

MVP nie będzie przedstawiane jako system optymalizujący rzeczywisty koszt zakupu energii.

## Konsekwencje

- Podstawą oceny będą metryki jakości prognoz i backtesting.
- Interfejs musi oddzielać prognozę, symulację i dane rzeczywiste.
- Deklarowanie oszczędności wymaga przyszłego rozszerzenia o alternatywne rynki, elastyczność portfela albo rzeczywiste dane transakcyjne.

