ALTER TABLE public.voice_settings
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS provider_voice_id text,
  ADD COLUMN IF NOT EXISTS provider_settings jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS cost_per_1k_chars numeric,
  ADD COLUMN IF NOT EXISTS supports_streaming boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_italian_native boolean DEFAULT false;

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.voice_settings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%voice_provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.voice_settings DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.voice_settings
  ADD CONSTRAINT voice_settings_provider_check
  CHECK (voice_provider IN (
    'elevenlabs','11labs','polly','cartesia','openai','inworld','azure','google','vapi'
  ));

CREATE INDEX IF NOT EXISTS idx_voice_settings_provider
  ON public.voice_settings(voice_provider) WHERE is_active = true;

COMMENT ON COLUMN public.voice_settings.model_id IS 'Modello TTS, es. eleven_v3, eleven_flash_v2_5, sonic-3, tts-1-hd';
COMMENT ON COLUMN public.voice_settings.provider_voice_id IS 'Voice ID per provider non-ElevenLabs';
COMMENT ON COLUMN public.voice_settings.provider_settings IS 'Parametri liberi specifici provider (JSON)';
COMMENT ON COLUMN public.voice_settings.latency_ms IS 'Latenza dichiarata/misurata in ms';
COMMENT ON COLUMN public.voice_settings.cost_per_1k_chars IS 'Costo per 1000 caratteri in USD';