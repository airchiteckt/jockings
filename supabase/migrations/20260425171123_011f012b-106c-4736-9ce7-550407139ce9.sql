DO $$
DECLARE
  rec RECORD;
  decrypted_phone text;
  digits_only text;
BEGIN
  FOR rec IN
    SELECT id, victim_phone, conversation_history
    FROM public.pranks
    WHERE call_status = 'failed'
  LOOP
    decrypted_phone := public.decrypt_victim_data(rec.victim_phone);
    digits_only := REGEXP_REPLACE(decrypted_phone, '\D', '', 'g');

    -- Marca solo i record con numero italiano malformato
    -- (13+ cifre totali e prefisso "39" → +39 duplicato).
    IF LENGTH(digits_only) >= 13 AND digits_only LIKE '39%' THEN
      UPDATE public.pranks
      SET conversation_history = COALESCE(conversation_history, '[]'::jsonb) || jsonb_build_object(
        'role', 'system',
        'content', 'Causa identificata (cleanup): numero salvato con prefisso paese duplicato (' || decrypted_phone || '). Bug del form ora corretto.',
        'timestamp', now()
      )
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;