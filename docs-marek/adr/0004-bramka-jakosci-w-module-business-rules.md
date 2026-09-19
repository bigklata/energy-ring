# Bramka jakości działa na module business rules, nie w kodzie modułu

Kontrole jakości danych PSE zapisujemy jako reguły modułu business rules — GUARD blokujący,
VALIDATION kwarantannujący, SET_FIELD nadający status, EMIT_EVENT wypychający werdykt na
mostek SSE — zamiast zaszywać je w TypeScripcie modułu importu.

## Considered Options

Rozważana była hybryda: twarde kontrole w kodzie, progi w konfiguracji, z godzinnym spike'em
na module reguł. Odrzucona świadomie na rzecz pełnego wykorzystania modułu, bo to właśnie
konfigurowalność bez redeploya jest tym, co ma zostać pokazane.

## Consequences

- Reguła da się poprawić z panelu admina na żywo, bez wdrożenia — co jest sednem pokazu,
  zwłaszcza w scenariuszu z ADR-0006.
- `rule_execution_logs` zapisuje kontekst wejścia i wyjścia, więc odpowiedź na pytanie
  „dlaczego ta partia trafiła do kwarantanny" jest darmowa.
- Reguły są indeksowane po `entity_type` i `event_type`, więc **muszą zaczepić się o mutację
  encji** — to wymusza istnienie `PartiaImportu` jako bytu zapisywanego (ADR-0005).
- Ryzyko: nieznana krzywa uczenia modułu. Jeśli okaże się blokująca, jest to wynik zgodny
  z celem projektu (rozpoznanie ograniczeń platformy) i należy go zapisać, a nie ukryć.
