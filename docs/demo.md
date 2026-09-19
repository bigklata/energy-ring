# Demo RDN — scenariusz replay doby historycznej

**Status: scenariusz odbiorowy, obecnie niewykonalny.** W tym commicie nie ma aktywnego modułu RDN ani klienta PSE, panelu `/backend/rdn-forecast`, komendy replay czy pełnej ścieżki API. [#40/G2](https://github.com/bigklata/energy-ring/issues/40) jest zablokowane przez [#39/G1](https://github.com/bigklata/energy-ring/issues/39). Instrukcja uruchomienia istniejącego panelu hosta jest w [README](../README.md). Nie przedstawiaj poniższych kroków jako wyniku przeprowadzonego pokazu.

## Przygotowanie przed próbą demo

1. Uruchom host według README i potwierdź, że panel `/backend` jest dostępny po zalogowaniu. To sprawdza tylko host.
2. Po ukończeniu #39/G1 potwierdź, że panel RDN czyta rzeczywiste, autoryzowane endpointy, a scenariusz `import → jakość → prognoza → ocena` przeszedł E2E **bez mocków i fixtures udających API**. Jeśli nie, przerwij próbę demo RDN.
3. Wybierz jedną dobę dostawy `D` w strefie `Europe/Warsaw` na podstawie kompletności i dostępności wersji, **przed obejrzeniem wyniku MAE**. Zapisz źródło PSE, identyfikatory/wersje zaakceptowanych partii wejściowych i cen, czas publikacji każdego rekordu, czas pobrania, odcięcie, wersję metody i parametrów oraz liczbę oczekiwanych interwałów wynikającą z kalendarza (92, 96 lub 100). Nie wpisuj „96” jako stałej.
4. Ustal **rodzaj replay** przed pokazem. `Historyczny replay point-in-time` wolno nazwać tak tylko wtedy, gdy istnieją utrwalone, datowane pobrania wymaganych wersji wejść **przed odcięciem**. Dzisiejszy odczyt archiwum PSE z dawnym czasem publikacji tego nie dowodzi. Gdy brak takiego dowodu, użyj jawnej etykiety **„REPLAY TESTOWY — FIXTURE, NIE WERYFIKACJA HISTORYCZNA”** i nie przedstawiaj wyniku jako historycznego backtestu. Jeśli brakuje kompletnych danych lub działającej funkcji replay, pokaż stan blokady zamiast liczby.

Publiczny katalog źródeł w [docs/pse-source-catalog.md](pse-source-catalog.md) jest wynikiem rozpoznania, nie gwarancją dostępności historii. Opis odcięcia i warunków oceny znajduje się w [docs/rdn-forecast-method.md](rdn-forecast-method.md). Około 13:50 D-1 to pojedyncza obserwacja publikacji ceny, **nie SLA PSE ani stała godzina odcięcia**; dane wykonania mają opóźnienie rzędu 10 godzin. Pusty poll w trakcie prezentacji nie jest dowodem awarii ani napływu danych na żywo.

## Przebieg pokazu — dopiero po odblokowaniu #39

1. Otwórz panel RDN jako uprawniony operator. Powiedz na głos i pokaż na ekranie: **„Odtworzenie wcześniej zapisanych danych; to nie jest prognoza live”**. Wyświetl dobę `D`, źródło PSE albo etykietę fixture, odcięcie i wersje wejść.
2. Pokaż zaakceptowane partie, kompletność MTU, czas publikacji i pobrania oraz wynik kontroli jakości. Przy brakach, późnym wejściu lub odrzuceniu pokaż przyczynę i zakończ tę gałąź bez prognozy.
3. Wybierz **utrwalony snapshot** i uruchom dostępny po implementacji replay w przyspieszonym tempie. Przyspieszenie dotyczy wyłącznie prezentacji zapisanych etapów; nie zmienia czasu publikacji, pobrania ani odcięcia. Replay nie powinien ponownie pobierać danych PSE ani podmieniać wersji wejść. Nie ma dziś polecenia CLI lub przycisku, które można tu uczciwie podać.
4. Pokaż dla tych samych interwałów prognozę, baseline D-1, baseline D-7, korektę i opublikowaną cenę rzeczywistą. Odróżnij prognozę wykonaną przed odcięciem od obliczenia wykonanego później w replay; nie nazywaj późnego uruchomienia prognozą live.
5. Jeżeli istnieje kompletna, zaakceptowana cena odniesienia, pokaż MAE trzech serii w PLN/MWh na **tym samym zbiorze MTU**, liczbę uwzględnionych i wyłączonych interwałów oraz przyczyny wyłączeń. Przy niewystarczającym pokryciu albo nieweryfikowalnej historii pokaż status, a nie pozornie porównywalną ocenę. Wynik gorszy od baseline’ów pozostaje widoczny.
6. Uruchom ponownie replay z identycznym snapshotem i parametrami; wynik ma być identyczny. Zanotuj rozbieżność jako błąd, nie wybieraj innej doby po obejrzeniu MAE.

## Warunek zaliczenia próby

Osoba, która nie pisała kodu, przechodzi scenariusz od czystego klona według README, obserwuje pochodzenie danych i ograniczenia historii na ekranie, a wynik zapisuje w komentarzu do #40: co działało, co myliło, co było zepsute. Rozbieżności trafiają do osobnych issue. Dokumentacja i fixtures w `docs/fixtures/rdn/` same nie spełniają tego warunku; `evaluation-test-fixture-replay.json` jest przykładem testowym, nie pomiarem PSE ani dowodem działającego UI. Do czasu ukończenia #39 i tej próby status #40 pozostaje otwarty.
