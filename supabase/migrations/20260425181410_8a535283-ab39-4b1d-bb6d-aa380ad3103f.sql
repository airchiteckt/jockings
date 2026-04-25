-- Inizializza le nuove chiavi modello per-provider con default sensati,
-- senza sovrascrivere eventuali valori esistenti.
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('cartesia_model', 'sonic-3', 'TTS model for Cartesia voices'),
  ('openai_tts_model', 'tts-1-hd', 'TTS model for OpenAI voices'),
  ('playht_model', 'PlayDialog', 'TTS model for PlayHT voices'),
  ('azure_tts_model', 'neural', 'TTS model for Azure voices')
ON CONFLICT (key) DO NOTHING;

-- Sanity reset: se elevenlabs_model contiene un valore non valido per ElevenLabs
-- (es. "sonic-3" residuo dal vecchio bug), lo riportiamo al default sicuro.
UPDATE public.app_settings
SET value = 'eleven_turbo_v2_5', updated_at = now()
WHERE key = 'elevenlabs_model'
  AND value NOT IN (
    'eleven_multilingual_v2','eleven_turbo_v2','eleven_turbo_v2_5',
    'eleven_flash_v2','eleven_flash_v2_5','eleven_monolingual_v1','eleven_v3'
  );