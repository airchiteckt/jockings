import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Heuristic: ElevenLabs voice IDs are 20-char alphanumeric (e.g. 21m00Tcm4TlvDq8ikWAM).
// Cartesia voice IDs are UUIDs (8-4-4-4-12 hex).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detectProvider(explicit: string | undefined, voiceId: string): string {
  if (explicit) {
    const p = explicit.toLowerCase();
    if (p === "11labs" || p === "elevenlabs") return "elevenlabs";
    if (p === "cartesia") return "cartesia";
    return p;
  }
  return UUID_RE.test(voiceId) ? "cartesia" : "elevenlabs";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceSettingId, voiceId, stability, similarity, style, speed, language, provider } = await req.json();

    if (!voiceSettingId || !voiceId) {
      return new Response(
        JSON.stringify({ error: "voiceSettingId and voiceId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const resolvedProvider = detectProvider(provider, voiceId);
    console.log(`Generating sample for voice ${voiceId} (provider=${resolvedProvider})`);

    const testTexts: Record<string, string> = {
      "Italiano": "Ciao! Sono pronto per fare scherzi telefonici divertentissimi!",
      "Napoletano": "Uè! So' pronto pe fa' scherzi telefonici spettacolari!",
      "Siciliano": "Talè! Sugnu prontu pi fari scherzi telefonici!",
      "Romano": "Aò! So' pronto pe fa' scherzi telefonici!",
      "Milanese": "Ciao! Son pront per fa scherzi telefonici!",
      "English": "Hello! I'm ready to make hilarious prank calls!",
      "Español": "¡Hola! ¡Estoy listo para hacer bromas telefónicas!",
      "Français": "Bonjour! Je suis prêt pour faire des farces téléphoniques!",
      "Deutsch": "Hallo! Ich bin bereit für Telefonstreiche!",
    };

    const testText = testTexts[language] || testTexts["Italiano"];

    let audioBytes: Uint8Array;
    let contentType = "audio/mpeg";
    let fileExt = "mp3";

    if (resolvedProvider === "cartesia") {
      const CARTESIA_API_KEY = Deno.env.get("CARTESIA_API_KEY");
      if (!CARTESIA_API_KEY) {
        return new Response(
          JSON.stringify({
            error: "Cartesia API key not configured",
            hint: "Add the CARTESIA_API_KEY secret to enable Cartesia sample generation.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cartesia voice model from app_settings
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "cartesia_model")
        .maybeSingle();
      const cartesiaModel = settingsData?.value || "sonic-2";

      const langMap: Record<string, string> = {
        Italiano: "it", Napoletano: "it", Siciliano: "it", Romano: "it", Milanese: "it",
        English: "en", Español: "es", Français: "fr", Deutsch: "de",
      };
      const cartesiaLang = langMap[language] || "it";

      const cartesiaResp = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: {
          "X-API-Key": CARTESIA_API_KEY,
          "Cartesia-Version": "2024-11-13",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: cartesiaModel,
          transcript: testText,
          voice: { mode: "id", id: voiceId },
          language: cartesiaLang,
          output_format: {
            container: "mp3",
            sample_rate: 44100,
            bit_rate: 128000,
          },
        }),
      });

      if (!cartesiaResp.ok) {
        const errorText = await cartesiaResp.text();
        console.error("Cartesia error:", errorText);
        return new Response(
          JSON.stringify({ error: "Cartesia API error", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      audioBytes = new Uint8Array(await cartesiaResp.arrayBuffer());
    } else {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: testText,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: stability ?? 0.5,
              similarity_boost: similarity ?? 0.75,
              style: style ?? 0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        console.error("ElevenLabs error:", errorText);
        return new Response(
          JSON.stringify({ error: "ElevenLabs API error", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      audioBytes = new Uint8Array(await elevenLabsResponse.arrayBuffer());
    }

    console.log("Audio generated, size:", audioBytes.byteLength);

    const fileName = `voice-samples/${voiceSettingId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("temp-audio")
      .upload(fileName, audioBytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("temp-audio")
      .getPublicUrl(fileName);

    const sampleAudioUrl = publicUrlData.publicUrl;
    console.log("Audio uploaded to:", sampleAudioUrl);

    const { error: updateError } = await supabase
      .from("voice_settings")
      .update({ sample_audio_url: sampleAudioUrl })
      .eq("id", voiceSettingId);

    if (updateError) {
      console.error("Database update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update voice settings", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sampleAudioUrl, provider: resolvedProvider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-voice-sample:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
