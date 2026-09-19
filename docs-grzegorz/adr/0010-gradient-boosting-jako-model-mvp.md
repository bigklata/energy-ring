# ADR-0010: Gradient boosting jako model MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Model będzie korzystać głównie z tabelarycznych cech czasowych, pogodowych i systemowych. Ilość danych jest ograniczona, a użytkownik powinien rozumieć, które czynniki wpłynęły na prognozę.

## Decyzja

Podstawowym modelem MVP będzie gradient boosting, implementowany za pomocą LightGBM albo XGBoost. Wynik prognozy będzie uzupełniony wyjaśnieniem wpływu cech, na przykład za pomocą SHAP.

Sieci neuronowe, modele sekwencyjne i LLM nie będą wymagane w MVP.

## Konsekwencje

- Model musi być porównany z modelami bazowymi opisanymi w ADR-0009.
- Trening i inferencja muszą używać wersjonowanego zestawu cech.
- Dla każdej prognozy trzeba zapisać wersję modelu oraz najważniejsze czynniki wpływające na wynik.
- Bardziej złożony model może zostać dodany wyłącznie po wykazaniu poprawy w takim samym backtestingu.

