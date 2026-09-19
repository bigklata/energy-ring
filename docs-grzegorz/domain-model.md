# Model domeny

## Dane platformowe

### DataSource

Konfiguracja adaptera PSE, ENTSO-E, Open-Meteo albo IMGW. Zawiera stan źródła i zasady synchronizacji, ale nie przechowuje jawnych sekretów.

### IngestionRun

Pojedyncze wykonanie importu z czasem rozpoczęcia i zakończenia, statusem, liczbą rekordów oraz błędem diagnostycznym.

### MarketDataPoint

Niezmienny punkt danych rynkowych lub systemowych: wskaźnik, wartość, jednostka, okres dostawy, czas publikacji, czas pobrania, źródło i wersja źródłowa.

### WeatherForecastRun

Wersja prognozy pogody dostępna w konkretnym momencie, zawierająca punkty prognozy dla lokalizacji i okresów dostawy.

### WeatherObservation

Rzeczywisty pomiar pogodowy używany do walidacji, oddzielony od prognozy pogody.

### FeatureSetVersion

Wersjonowana definicja cech wejściowych, transformacji i reguł agregowania danych.

### ModelVersion

Kandydat albo aktywna wersja modelu. Zawiera artefakt, hash, wersję zestawu cech, metryki i status.

### TrainingRun

Wykonanie treningu i backtestingu powiązane z kandydatem modelu, zakresem danych i wynikiem walidacji.

### ForecastRun

Uruchomienie aktywnego modelu dla wskazanej doby dostawy.

### ForecastPoint

Godzinowa prognoza ceny albo zapotrzebowania wraz z przedziałem niepewności i najważniejszymi czynnikami SHAP.

## Dane tenantowe

### PortfolioScenario

Wersjonowana konfiguracja symulowanego mieszanego portfela należąca do tenant i organization.

### PortfolioSegment

Segment gospodarstw domowych, firm usługowych albo przemysłu wraz z udziałem i profilem zapotrzebowania.

### SimulationRun

Uruchomienie symulacji łączące wersję scenariusza z konkretnym ForecastRun.

### SimulationPoint

Godzinowy wynik symulacji: zapotrzebowanie, brakujący wolumen, prognozowana cena i oznaczenie wyniku jako symulowanego.

## Niezmienniki

- Udziały segmentów aktywnej wersji PortfolioScenario sumują się do 100%.
- Dane źródłowe są dopisywane i wersjonowane, a nie nadpisywane.
- ForecastRun wskazuje dokładnie jedną ModelVersion i jedną FeatureSetVersion.
- SimulationRun nie może łączyć danych należących do różnych tenantów lub organizacji.
- Operacje użytkownika nie mogą zmieniać danych platformowych.
- Prognoza, obserwacja i wynik symulacji pozostają odrębnymi typami danych.

