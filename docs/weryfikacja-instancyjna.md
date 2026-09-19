# Weryfikacja instancyjna (`verify:instance`) — runbook

Procedura dla Issue z etykietą `verify:instance`. Uruchamiasz ją **na swoim
sandboxie**, na commicie, który idzie do PR-a, i wklejasz do PR-a **tekst**
wygenerowany w kroku 5. Zasady progów: `.ai/review-checklist.md`, sekcja
„Verification gate”.

Dowód składa się z dwóch części i obie są obowiązkowe:

1. `yarn db:migrate` na **czystej** bazie — liczba zastosowanych migracji.
2. `yarn test:integration:ephemeral` — ile testów uruchomiono i ile przeszło.

Wszystkie bloki są w `bash`, kopiujesz je po kolei w **jednej** sesji terminala
(krok 2 ustawia zmienne używane w krokach 3–6). Zakładają katalog główny repo.

## 0. Wymagania wstępne (jednorazowo na sandboxie)

```bash
node -v                       # wymagane >= 24 (inaczej yarn install: "Node >= 24 required")
corepack enable && yarn -v    # yarn 4.x z packageManager
docker info --format '{{.ServerVersion}}'   # ephemeral stawia Postgresa w kontenerze
grep -E '^(DATABASE_URL|JWT_SECRET|AUTH_SECRET)=' .env | sed -E 's/=.*/=<ustawione>/'
```

- `.env` musi mieć `DATABASE_URL` do Postgresa, na którym wolno utworzyć nową
  bazę (`CREATE DATABASE`).
- `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET` **nie mogą** mieć wartości
  z `.env.example` — serwer w trybie produkcyjnym (którego używa ephemeral)
  odmawia startu. Jednorazowa podmiana na losowe wartości, bez wypisywania ich:

```bash
for k in JWT_SECRET AUTH_SECRET NEXTAUTH_SECRET; do
  v=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
  if grep -q "^$k=" .env; then sed -i.bak "s|^$k=.*|$k=$v|" .env; else echo "$k=$v" >> .env; fi
done
rm -f .env.bak
```

## 1. Checkout na właściwym commicie

```bash
git status --short            # ma być pusto (poza plikami, o których wiesz, że nie są w PR)
git switch <twoj-branch> && git pull --ff-only
yarn install
yarn generate
export VERIFY_SHA="$(git rev-parse HEAD)"; echo "$VERIFY_SHA"
```

Dowód obowiązuje tylko dla tego SHA. Każdy nowy commit w PR = nowy przebieg.

## 2. Czysta baza — osobna, jednorazowa

Nie migrujemy bazy, na której pracuje sandbox. Tworzymy nową, pustą bazę obok
niej (ten sam serwer z `DATABASE_URL`, inna nazwa):

```bash
export VERIFY_DB="om_verify_$(date +%Y%m%d%H%M%S)"
export VERIFY_URL="$(node --env-file=.env -e '
const { Client } = require("pg");
const url = new URL(process.env.DATABASE_URL);
const db = process.env.VERIFY_DB;
(async () => {
  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  await c.query(`CREATE DATABASE "${db}"`);
  await c.end();
  url.pathname = "/" + db;
  console.log(url.toString());
})().catch((e) => { console.error(e.message); process.exit(1); });
')"
test -n "$VERIFY_URL" && echo "czysta baza: $VERIFY_DB"
```

## 3. Migracje na czystej bazie

```bash
set -o pipefail
DATABASE_URL="$VERIFY_URL" yarn db:migrate 2>&1 | tee /tmp/verify-migrate.log
export MIGRATE_EXIT=$?; echo "db:migrate exit=$MIGRATE_EXIT"
```

Na czystej bazie **każdy** moduł z migracjami wypisuje `<modul>: N migration(s)
applied`, w tym moduł z Twojego Issue (np. `rdn_forecast: 1 migration applied`).
`no pending migrations` przy module aplikacji oznacza, że baza nie była czysta.

## 4. Testy integracyjne na efemerycznej instancji

```bash
set -o pipefail
yarn test:integration:ephemeral --force-rebuild --no-reuse-env 2>&1 | tee /tmp/verify-int.log
export INT_EXIT=$?; echo "test:integration:ephemeral exit=$INT_EXIT"
```

- `--force-rebuild` — bez niego build sprzed ≤ 600 s jest używany ponownie
  (`Build cache valid ... Skipping build pipeline`), więc testy mogą chodzić na
  kodzie sprzed Twojej ostatniej zmiany.
- `--no-reuse-env` — bez niego runner podpina się pod pozostawione środowisko
  (`.ai/qa/ephemeral-env.json`) z danymi poprzedniego przebiegu.
- Runner sam stawia Postgresa w kontenerze, stosuje migracje, buduje i startuje
  aplikację (z `--no-reuse-env` na losowym wolnym porcie, np. `127.0.0.1:58068`),
  a na końcu sprząta kontener.
- Uruchamiane są wyłącznie specyfikacje aplikacji:
  `src/modules/<modul>/__integration__/*.spec.ts`. Specyfikacje pakietów z
  `node_modules/@open-mercato/**` są wykluczone w `.ai/qa/tests/playwright.config.ts`.

Test musi być samowystarczalny: tworzy własne dane w setupie (unikalne
identyfikatory z sufiksem czasu), weryfikuje efekt **przez API**, sprząta w
teardownie i nie korzysta z danych zasianych.

## 5. Dowód do PR-a — jedna komenda

```bash
{
  echo "SHA dowodu: $VERIFY_SHA"
  echo "## db:migrate na czystej bazie ($VERIFY_DB) — exit=$MIGRATE_EXIT"
  grep -E "migrations? applied" /tmp/verify-migrate.log \
    | awk '{ m++; s += $2 } END { print "modules=" m+0 ", migrations applied=" s+0 }'
  grep -E "^ *($(ls src/modules | paste -sd'|' -)): " /tmp/verify-migrate.log
  grep -E "Failed|Error" /tmp/verify-migrate.log
  echo "## test:integration:ephemeral — exit=$INT_EXIT"
  grep -E "^Running [0-9]+ tests? |^ +[0-9]+ (passed|failed|flaky|skipped|interrupted|did not run)|No tests found|Failed:" /tmp/verify-int.log
} | tee /tmp/verify-evidence.txt
```

Wklej całość `/tmp/verify-evidence.txt` do PR-a w blok ```` ```text ````,
a SHA również w pole „SHA dowodu” szablonu PR.

### Które linie są dowodem

| linia | co dowodzi | warunek zaliczenia |
| --- | --- | --- |
| `SHA dowodu: …` | wersja kodu | równa ostatniemu commitowi PR-a |
| `db:migrate … exit=0` | migracje weszły bez błędu | `exit=0` |
| `modules=M, migrations applied=N` | baza była czysta i dostała cały schemat | `N > 0`; `M` = liczba modułów z migracjami |
| `<modul>: N migration(s) applied` | migracja z Twojego Issue weszła (wypisywane są tylko moduły z `src/modules`) | obecna dla modułu z Issue |
| `test:integration:ephemeral — exit=0` | runner zakończył się sukcesem | `exit=0` |
| `Running T tests using …` | ile testów uruchomiono | `T ≥ 1`, w tym test z Twojego Issue |
| `P passed (…)` | ile przeszło | `P = T`; brak linii `failed`/`flaky`/`interrupted`/`did not run` |

Nie są dowodem: sama linia `Done`, `✓ Ready`, zrzut ekranu konsoli, wynik
`yarn test` (to `verify:unit`) ani przebieg na bazie, na której wcześniej
działał sandbox.

### Przykład poprawnego dowodu

Przebieg próbny tej procedury (2026-09-19, lokalnie: macOS + Colima, Postgres
`pgvector/pgvector:pg17-trixie`) na commicie `607337f` z PR #48. Liczby
migracji są prawdziwe. Test pochodził z tymczasowego specu dymnego, bo w
repozytorium nie było jeszcze żadnego specu aplikacji — patrz „Częste porażki”.

```text
SHA dowodu: 607337f…
## db:migrate na czystej bazie (om_verify_20260919160604) — exit=0
modules=46, migrations applied=295
 rdn_forecast: 1 migration applied
## test:integration:ephemeral — exit=0
Running 1 test using 1 worker
  1 passed (19.8s)
```

## 6. Sprzątanie

```bash
VERIFY_DB="$VERIFY_DB" node --env-file=.env -e '
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${process.env.VERIFY_DB}" WITH (FORCE)`);
  const r = await c.query("select count(*)::int n from pg_database where datname like $1", ["om_verify_%"]);
  console.log("pozostale bazy om_verify_*:", r.rows[0].n);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
'
docker ps --format '{{.Names}} {{.Image}}'   # nie powinno być kontenerów po ephemeral
```

`testcontainers-ryuk-*` może być widoczny jeszcze przez kilkanaście sekund —
to sprzątacz testcontainers, sam się wyłącza. Każdy inny kontener Postgresa po
ephemeral (poza bazą sandboxa) usuń: `docker rm -f <nazwa>`.

## Częste porażki

| objaw | przyczyna | co zrobić |
| --- | --- | --- |
| `Error: No tests found` i `exit=1` | w `src/modules/*/__integration__/` nie ma żadnego specu; specy pakietów są wykluczone | To **nie** jest dowód. Dodaj w swoim zadaniu spec `src/modules/<modul>/__integration__/TC-…spec.ts` weryfikujący efekt przez API. Jeśli Issue na to nie pozwala — napisz komentarz i podziel zadanie; nie obniżaj progu. |
| `Refusing to run in production with an unsafe signing secret` / `Application process exited before readiness check` | `JWT_SECRET`/`AUTH_SECRET` z `.env.example` | Krok 0 — podmiana sekretów. |
| `Node >= 24 required` przy `yarn install` | stary Node | `nvm install 24 && nvm use 24`. |
| `Container runtime is unavailable` / `Docker CLI is not available` | brak Dockera | Uruchom Docker (na macOS np. `colima start`) i powtórz krok 4. |
| `CREATE DATABASE` → `permission denied` | użytkownik z `DATABASE_URL` nie ma `CREATEDB` | Postaw osobnego Postgresa: `docker run -d --name om-verify-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 pgvector/pgvector:pg17-trixie` i w kroku 2 użyj `DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres node -e …`; po wszystkim `docker rm -f om-verify-pg`. |
| migracja nie wchodzi na czystej bazie | błąd w SQL albo zależność od stanu, którego czysta baza nie ma | Popraw encję, wygeneruj migrację ponownie (`yarn db:generate`), przejrzyj SQL. Nigdy nie edytuj migracji już scalonej do `main` — dodaj nową. Jeśli `db:generate` wygenerował pliki dla innych modułów, usuń je. |
| `<modul aplikacji>: no pending migrations` w kroku 3 | migracje poszły na starą bazę (np. `DATABASE_URL` nie został podmieniony) | Dowód nieważny — powtórz kroki 2–3 w tej samej sesji terminala. |
| `Build cache valid ... Skipping build pipeline` w logu | uruchomienie bez `--force-rebuild` | Powtórz krok 4 z flagami. |
| test przechodzi raz, a przy drugim przebiegu pada na unikalności | test nie sprząta albo używa stałych identyfikatorów | Sufiks czasu w identyfikatorach, sprzątanie w `afterAll` przez API. Sprawdzenie: `--keep`, a potem drugi przebieg z tym samym środowiskiem. |
| sandbox ma stan po poprzednim zadaniu | brudny checkout, stare `.ai/qa/ephemeral-env.json`, zostawione kontenery lub bazy `om_verify_*` | `git status`, `--no-reuse-env`, `docker ps -a`, krok 6. |
| `[query_index] Could not read reindex declarations from …: Cannot find package 'src'` | znane ostrzeżenie CLI przy migracjach aplikacji | Nie blokuje; wynik oceniasz po liczniku i `exit`. |
