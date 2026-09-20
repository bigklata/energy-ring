# Trwały import RDN (#26)

`rdn_forecast.import` pobiera csdac-pln przez istniejącego klienta PSE i adapter I3. Źródło musi być aktywnym rekordem w bieżącym tenancie i organizacji. Stan `received` oznacza zapisany snapshot, a nie zgodę na prognozowanie; ocenę jakości i przejście do `accepted` dostarcza #27.

Cały pobrany zestaw stron jest normalizowany przed transakcją. W transakcji blokowany jest rekord źródła, ponownie sprawdzany klucz idempotencji, a partia i wszystkie punkty są zapisywane przez `withAtomicFlush`. Błąd strony providera albo zapisu punktów nie zostawia partii ani zajętego klucza.

Ten sam klucz i payload zwracają pierwotną partię. Zmieniony payload pod tym kluczem daje 409. Inny klucz dla już zapisanej rewizji też daje 409: obecny schemat nie ma rejestru aliasów kluczy i nie udaje, że zapamiętał drugi klucz. Rewizja uwzględnia publikację i wartość każdego punktu, a nowe dane wskazują `supersedesBatchId`. Cofnięcie publikacji lub niejednoznaczna wcześniejsza linia rewizji jest konfliktem.

`GET /api/rdn_forecast/sources` i `/batches` czytają własne dane z bazy. `GET /api/rdn_forecast/batches/{id}` zwraca również stronicowane punkty. Dane prognoz i ocen pozostają odrębnymi stubami.

## Testy

`yarn test:integration:ephemeral --force-rebuild --no-reuse-env` nadal uruchamia natywny runner Mercato. Cienki launcher uruchamia kontrolowany provider na losowym porcie loopback i przechwytuje wyłącznie wychodzące zapytania PSE w procesach testowych. Nie zmienia produkcyjnej allowlisty, nie dodaje testowych route'ów do aplikacji ani nie używa żywego PSE.

Każda próba ma świeżą bazę: test rollbacku celowo zakłada ograniczony do własnego źródła trigger odmawiający zapisu. Fixtures tworzą własne dwa tenanty, trzy organizacje, użytkowników i źródła, a wynik importu jest odczytywany przez rzeczywiste API. Źródła i tenanty powstają przez istniejący helper `withClient`, bo publiczne admin API nie udostępnia ich nieuprzywilejowanemu operatorowi importu. Aplikacja nadal samodzielnie uwierzytelnia tych użytkowników i wyznacza scope.

Do interaktywnej eksploracji służy `yarn test:integration:ephemeral:start`. `Ctrl+C` sprząta własny provider i aplikację. Drugi launcher w tym samym checkoutcie nie może nadpisać konfiguracji działającego pierwszego. Wspólne dev/stage nie są resetowane.
