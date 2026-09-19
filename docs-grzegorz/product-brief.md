# Energy Ring — product brief MVP

> **Zakres MVP zaktualizowany 2026-09-19.** Użytkownik wybrał prognozę RDN: import PSE, kontrola jakości, korekta baseline’u i porównanie z opublikowanymi cenami. Bez tradingu, portfela i treningu ML. Decyzja: [issue #2](https://github.com/bigklata/energy-ring/issues/2); robocza specyfikacja: [.ai/specs/2026-09-19-rdn-forecast-mvp.md](../.ai/specs/2026-09-19-rdn-forecast-mvp.md). Zakres produktowy jest zatwierdzony, projekt techniczny pozostaje Draft.

> Poniższy brief SaaS/ML oraz jego dokumenty pochodne są alternatywą poza aktualnym MVP; zachowano oryginalną analizę.

## Problem

Analityk rynku energii potrzebuje jednego miejsca do obserwowania pracy KSE, prognozowania godzinowych cen RDN i badania wpływu prognoz na symulowany portfel zakupowy.

## Użytkownik

Pierwszym użytkownikiem jest analityk lub sprzedawca energii działający na polskim rynku hurtowym. Platforma ma docelowo obsługiwać wiele firm z izolacją danych tenantowych.

## Zakres MVP

- automatyczny import danych co 15 minut,
- dane PSE, ENTSO-E, Open-Meteo i IMGW,
- backfill od 1 stycznia 2021 roku,
- godzinowa prognoza cen i zapotrzebowania na następne 24 godziny,
- symulowany mieszany portfel z konfigurowalnymi udziałami gospodarstw domowych, firm usługowych i przemysłu,
- wyjaśnienia prognoz za pomocą SHAP,
- codzienny trening i kontrolowana aktywacja kandydatów modelu,
- kroczący backtesting oraz porównanie z modelami bazowymi,
- dashboard, prognozy, scenariusze, symulacje i panel administracyjny.

## Poza zakresem MVP

- automatyczne składanie zleceń,
- integracja z rzeczywistym portfelem tradera,
- Rynek Dnia Bieżącego i rynek terminowy,
- deklarowanie rzeczywistych oszczędności,
- prognozy dla pojedynczych 15-minutowych MTU,
- zależność od płatnych lub niezweryfikowanych licencyjnie danych TGE,
- Kubernetes i wysoka dostępność.

## Architektura

- moduł Open Mercato: integracje, PostgreSQL, RBAC, scenariusze, UI i zadania,
- Python ML service: LightGBM albo XGBoost, SHAP, trening, backtesting i inferencja,
- PostgreSQL: jedyny trwały magazyn danych i artefaktów modeli,
- Redis: kolejki zadań,
- Docker Compose: środowisko lokalne i pierwsze wdrożenie VPS.

## Kryterium sukcesu

Model cenowy osiąga w kroczącym backtestingu MAE co najmniej 10% niższe od lepszego modelu bazowego: ceny tej samej godziny poprzedniego dnia lub poprzedniego tygodnia.

## Ograniczenia

- Wszystkie rekomendacje są oznaczone jako symulacje.
- Brak krytycznych danych blokuje publikację nowej prognozy.
- Dane klienta są izolowane przez tenant i organization.
- Model nie używa LLM ani formatu pickle.

## Dokumenty powiązane

- [Model domeny](domain-model.md)
- [Glossary](glossary.md)
- [ADR](adr/)
