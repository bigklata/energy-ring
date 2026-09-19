# ADR-0016: Ekrany MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Interfejs ma wspierać analizę rynku, prognozy, symulacje portfela oraz operacje administracyjne bez możliwości wykonywania transakcji.

## Decyzja

MVP będzie posiadać pięć głównych obszarów:

1. Overview: aktualne dane KSE, cena i stan źródeł.
2. Forecast: prognozy godzinowe ceny i zapotrzebowania, niepewność oraz wyjaśnienia SHAP.
3. Portfolio Scenarios: konfiguracja i wersje miksu portfela.
4. Simulation & Backtesting: wolumen, prognozowany koszt oraz porównanie z historią.
5. Platform Admin: źródła, importy, treningi i wersje modeli.

## Konsekwencje

- Platform Admin jest dostępny wyłącznie dla odpowiedniej roli.
- Viewer nie zobaczy akcji modyfikujących ani uruchamiających obliczenia.
- Każdy ekran pokazuje czas i pochodzenie prezentowanych danych.
- Prognozy oraz symulacje muszą być wizualnie odróżnione od obserwacji rzeczywistych.

