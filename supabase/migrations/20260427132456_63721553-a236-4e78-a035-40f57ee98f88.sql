ALTER TABLE public.pranks 
ADD COLUMN IF NOT EXISTS listen_url TEXT;

DROP FUNCTION IF EXISTS public.get_user_pranks_decrypted();

CREATE OR REPLACE FUNCTION public.get_user_pranks_decrypted()
 RETURNS TABLE(id uuid, user_id uuid, victim_phone text, victim_first_name text, victim_last_name text, prank_theme text, voice_gender text, voice_provider text, elevenlabs_voice_id text, elevenlabs_stability numeric, elevenlabs_similarity numeric, elevenlabs_style numeric, elevenlabs_speed numeric, language text, personality_tone text, max_duration integer, creativity_level integer, send_recording boolean, call_status text, recording_url text, scheduled_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, twilio_call_sid text, conversation_history jsonb, pregenerated_greeting_url text, pregenerated_background_url text, listen_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.user_id,
    public.decrypt_victim_data(p.victim_phone) as victim_phone,
    public.decrypt_victim_data(p.victim_first_name) as victim_first_name,
    public.decrypt_victim_data(p.victim_last_name) as victim_last_name,
    p.prank_theme,
    p.voice_gender,
    p.voice_provider,
    p.elevenlabs_voice_id,
    p.elevenlabs_stability,
    p.elevenlabs_similarity,
    p.elevenlabs_style,
    p.elevenlabs_speed,
    p.language,
    p.personality_tone,
    p.max_duration,
    p.creativity_level,
    p.send_recording,
    p.call_status,
    p.recording_url,
    p.scheduled_at,
    p.created_at,
    p.updated_at,
    p.twilio_call_sid,
    p.conversation_history,
    p.pregenerated_greeting_url,
    p.pregenerated_background_url,
    p.listen_url
  FROM public.pranks p
  WHERE p.user_id = auth.uid()
$function$;