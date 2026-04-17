
L'utente conferma di procedere. Devo presentare il piano per stabilizzare il database.

**Situazione**: Il DB Supabase è in saturazione CPU (errori 503). Le migrazioni di indicizzazione vanno in timeout. Causa: due cron job (ID 1 e 2) girano ogni minuto saturando le risorse.

**Piano in 2 fasi**:

## Fase 1 — Sblocco immediato (stop cron jobs)

Eseguire una migrazione minima per fermare i cron job ad alta frequenza:

```sql
SELECT cron.unschedule(1);
SELECT cron.unschedule(2);
```

Questo libera la CPU del database in pochi secondi.

## Fase 2 — Ottimizzazione completa

Una volta stabilizzato il DB, eseguire la migrazione di ottimizzazione:

**Pulizia storico cron** (riduce bloat immediato):
```sql
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '24 hours';
```

**Indici per eliminare sequential scan**:
- `pranks(call_status, scheduled_at)` — usato da `process-scheduled-pranks`
- `pranks(reveal_sms_scheduled_at)` — usato da `process-reveal-sms`
- `pranks(user_id, created_at DESC)` — usato dalla pagina History
- `pranks(twilio_call_sid)` — usato dal webhook VAPI
- Indici su `call_queue`, `processed_payments`, `prank_disclaimer_acceptances`

**Riprogrammazione cron a frequenza ridotta** (ogni 2 minuti invece di ogni minuto):
- `process-scheduled-pranks` → `*/2 * * * *`
- `process-reveal-sms` → `*/2 * * * *`

**Job di manutenzione automatica** (ogni 6 ore):
- Pulizia automatica di `cron.job_run_details` più vecchi di 24h

**Aggiornamento statistiche**:
```sql
ANALYZE public.pranks;
ANALYZE public.call_queue;
```

## Risultato atteso

- Errori 503 risolti
- Carico CPU drasticamente ridotto (~50% in meno dai cron)
- Query su pranks più veloci (da seq scan a index scan)
- Storico cron mantenuto pulito automaticamente
- Funzionalità invariata (i cron continuano a girare, solo a frequenza più ragionevole)

Procedo con la Fase 1, poi Fase 2 a stretto giro.
