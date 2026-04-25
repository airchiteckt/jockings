-- Tabella snapshot per backup completo configurazione VAPI/Voices
CREATE TABLE public.vapi_settings_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Snapshot dei dati
  app_settings_data jsonb NOT NULL DEFAULT '{}'::jsonb,    -- Tutte le righe di app_settings (key/value VAPI)
  voice_settings_data jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Tutti i preset di voice_settings
  -- Metadati utili
  is_auto boolean NOT NULL DEFAULT false,                  -- Se creato automaticamente prima di un restore
  source_snapshot_id uuid                                  -- Riferimento allo snapshot da cui è stato fatto il restore
);

ALTER TABLE public.vapi_settings_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage snapshots"
ON public.vapi_settings_snapshots
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_vapi_snapshots_created_at ON public.vapi_settings_snapshots(created_at DESC);
CREATE INDEX idx_vapi_snapshots_is_auto ON public.vapi_settings_snapshots(is_auto);