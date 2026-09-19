# ADR-0013: Artefakty modeli w PostgreSQL

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

MVP ma używać PostgreSQL jako jedynego trwałego magazynu. Dodanie S3 lub MinIO wyłącznie dla niewielkich artefaktów modeli zwiększyłoby złożoność operacyjną.

## Decyzja

Artefakty modeli będą przechowywane w PostgreSQL razem z wersją modelu, wersją zestawu cech, metrykami, statusem i kryptograficznym hashem integralności.

Model będzie serializowany w natywnym, nieuruchamialnym formacie LightGBM albo XGBoost. Format Python pickle jest zabroniony.

## Konsekwencje

- Serwis ML pobiera wyłącznie artefakt wskazanej, zatwierdzonej wersji.
- Hash jest weryfikowany przed użyciem modelu.
- Artefakty kandydatów i poprzednich aktywnych wersji pozostają dostępne do audytu oraz rollbacku.
- Potrzeba zewnętrznego magazynu obiektowego zostanie oceniona ponownie, jeśli rozmiar lub liczba artefaktów zacznie wpływać na bazę.

