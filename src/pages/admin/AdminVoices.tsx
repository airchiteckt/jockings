import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mic, Save, Plus, Trash2, Shield, Play, Volume2, Loader2, Music, Brain, Phone, Zap, Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VoiceTestDialog } from "@/components/VoiceTestDialog";
import { VoiceSettingsAuditLog, logBatchChanges, logVoiceSettingChange } from "@/components/admin/VoiceSettingsAuditLog";
import { VapiSnapshotsManager } from "@/components/admin/VapiSnapshotsManager";

// Centralized types
import type { VapiSettings, VoiceSetting, VapiVoicePreset } from "@/types/vapiSettings";
import { DEFAULT_VAPI_SETTINGS, DEFAULT_SYSTEM_PROMPT_IT, DEFAULT_SYSTEM_PROMPT_EN, DEFAULT_FIRST_MESSAGE_IT, DEFAULT_FIRST_MESSAGE_EN } from "@/types/vapiSettings";

// Centralized constants
import {
  LANGUAGES, GENDERS, ELEVENLABS_MODELS, AI_MODELS, VAPI_VOICE_PROVIDERS, VAPI_TRANSCRIBER_PROVIDERS,
  VAPI_AI_MODELS, VAPI_ELEVENLABS_VOICES, DEEPGRAM_MODELS, DEEPGRAM_LANGUAGES, GOOGLE_STT_MODELS,
  GOOGLE_STT_LANGUAGES, OPENAI_STT_MODELS, OPENAI_STT_LANGUAGES, ASSEMBLYAI_MODELS, ASSEMBLYAI_LANGUAGES,
  AZURE_STT_LANGUAGES, TALKSCRIBER_MODELS, TALKSCRIBER_LANGUAGES, GLADIA_MODELS, GLADIA_LANGUAGES,
  CARTESIA_MODELS, CARTESIA_LANGUAGES, ELEVENLABS_STT_LANGUAGES, SPEECHMATICS_LANGUAGES,
  OPENAI_TTS_MODELS, AZURE_TTS_VOICES, PLAYHT_MODELS,
  getAiProviderFromModel,
} from "@/constants/vapiOptions";


// All types and constants now imported from centralized modules

const AdminVoices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading } = useAdminCheck();
  const [voiceSettings, setVoiceSettings] = useState<VoiceSetting[]>([]);
  const [selectedSetting, setSelectedSetting] = useState<VoiceSetting | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLanguage, setNewLanguage] = useState("Italiano");
  const [newGender, setNewGender] = useState("male");
  const [testingVoice, setTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [soundPrompt, setSoundPrompt] = useState("");
  const [generatingSound, setGeneratingSound] = useState(false);
  const [soundPreviewUrl, setSoundPreviewUrl] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState("google/gemini-2.5-flash-lite");
  const [savingAiModel, setSavingAiModel] = useState(false);
  const [voiceTestOpen, setVoiceTestOpen] = useState(false);
  const [generatingSampleId, setGeneratingSampleId] = useState<string | null>(null);
  
  // Voice TTS models per provider (each provider has its own model field to avoid cross-contamination)
  const [voiceModels, setVoiceModels] = useState({
    elevenlabs: "eleven_turbo_v2_5",
    cartesia: "sonic-3",
    openai: "tts-1-hd",
    playht: "PlayDialog",
    azure: "neural",
  });
  
  // Call Provider selection
  const [callProvider, setCallProvider] = useState<"twilio" | "vapi">("twilio");
  const [vapiSettings, setVapiSettings] = useState<VapiSettings>(DEFAULT_VAPI_SETTINGS);
  const [savingCallProvider, setSavingCallProvider] = useState(false);
  
  // VAPI Voice Presets (type imported from @/types/vapiSettings)
  const [vapiVoicePresets, setVapiVoicePresets] = useState<VapiVoicePreset[]>([]);
  const [isAddVapiPresetOpen, setIsAddVapiPresetOpen] = useState(false);
  const [newVapiPreset, setNewVapiPreset] = useState<Omit<VapiVoicePreset, 'id'>>({
    language: "Italiano",
    gender: "male",
    voiceId: "",
    voiceProvider: "11labs",
    voice_name: "",
    description: "",
    notes: ""
  });
  
  // Store previous settings for change detection
  const previousSettingsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/auth");
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchVoiceSettings();
      fetchAiModel();
      fetchCallProvider();
      fetchVapiVoicePresets();
    }
  }, [isAdmin]);


  const fetchVapiVoicePresets = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vapi_voice_presets")
      .maybeSingle();
    
    if (data?.value) {
      try {
        const presets = JSON.parse(data.value);
        setVapiVoicePresets(presets);
      } catch (e) {
        console.error("Error parsing VAPI voice presets:", e);
      }
    }
  };

  const handleSaveVapiPreset = async () => {
    if (!newVapiPreset.voiceId) {
      toast({ title: "Errore", description: "Inserisci un Voice ID", variant: "destructive" });
      return;
    }
    
    if (!newVapiPreset.voice_name) {
      toast({ title: "Errore", description: "Inserisci un titolo per la voce", variant: "destructive" });
      return;
    }
    
    // Save directly to voice_settings table
    const { data: insertedData, error } = await supabase
      .from("voice_settings")
      .insert({
        language: newVapiPreset.language,
        gender: newVapiPreset.gender,
        voice_provider: newVapiPreset.voiceProvider,
        elevenlabs_voice_id: newVapiPreset.voiceId,
        voice_name: newVapiPreset.voice_name,
        description: newVapiPreset.description || null,
        notes: newVapiPreset.notes || null,
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      setIsAddVapiPresetOpen(false);
      setNewVapiPreset({ language: "Italiano", gender: "male", voiceId: "", voiceProvider: "11labs", voice_name: "", description: "", notes: "" });
      toast({ title: "Salvato!", description: "Voce aggiunta. Generazione sample in corso..." });
      fetchVoiceSettings();
      
      // Auto-generate sample for the new voice
      if (insertedData?.id) {
        try {
          await supabase.functions.invoke("generate-voice-sample", {
            body: {
              voiceSettingId: insertedData.id,
              voiceId: newVapiPreset.voiceId,
              stability: 0.5,
              similarity: 0.75,
              style: 0,
              speed: 1,
              language: newVapiPreset.language,
            },
          });
          toast({ title: "Sample generato!", description: "L'anteprima audio è stata salvata automaticamente" });
          fetchVoiceSettings();
        } catch (err) {
          console.error("Auto-generate sample error:", err);
          toast({ title: "Attenzione", description: "Sample non generato. Puoi generarlo manualmente.", variant: "default" });
        }
      }
    }
  };

  const handleDeleteVapiPreset = async (presetId: string) => {
    const updatedPresets = vapiVoicePresets.filter(p => p.id !== presetId);
    
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "vapi_voice_presets", value: JSON.stringify(updatedPresets) }, { onConflict: "key" });
    
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      setVapiVoicePresets(updatedPresets);
      toast({ title: "Eliminato!", description: "Preset voce rimosso" });
    }
  };

  const fetchAiModel = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_model")
      .single();
    
    if (!error && data) {
      setAiModel(data.value);
    }
  };

  // ElevenLabs model is fetched as part of fetchCallProvider via vapi settings

  const fetchCallProvider = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "call_provider", 
        "vapi_phone_number_id",
        "vapi_caller_id",
        "vapi_assistant_id",
        "vapi_ai_provider",
        "vapi_ai_model",
        "vapi_temperature",
        "vapi_max_tokens",
        "vapi_voice_provider",
        "vapi_voice_speed",
        "vapi_voice_stability",
        "vapi_voice_similarity_boost",
        "vapi_voice_style",
        "vapi_voice_speaker_boost",
        "vapi_filler_injection_enabled",
        "vapi_transcriber_provider",
        "vapi_transcriber_model",
        "vapi_transcriber_language",
        "vapi_first_message",
        "vapi_first_message_mode",
        "vapi_silence_timeout",
        "vapi_max_duration",
        "vapi_background_sound",
        "vapi_backchanneling",
        "vapi_end_call_message",
        "vapi_voicemail_message",
        "vapi_end_call_phrases",
        "vapi_system_prompt_it",
        "vapi_system_prompt_en",
        "vapi_first_message_it",
        "vapi_first_message_en",
        "vapi_start_speaking_wait",
        "vapi_smart_endpointing_enabled",
        "vapi_smart_endpointing_provider",
        "vapi_transcription_endpointing_enabled",
        "vapi_stop_speaking_num_words",
        "vapi_stop_speaking_voice_seconds",
        "vapi_stop_speaking_backoff_seconds",
        "vapi_smart_denoising_enabled",
        "vapi_recording_enabled",
        "vapi_transcript_enabled",
        "vapi_first_message_interruptions",
        "vapi_voicemail_detection",
        "vapi_hipaa_enabled",
        "vapi_background_denoising",
        "vapi_model_output_in_messages",
        "elevenlabs_model",
        "cartesia_model",
        "openai_tts_model",
        "playht_model",
        "azure_tts_model",
      ]);
    
    if (data) {
      const newSettings = { ...DEFAULT_VAPI_SETTINGS };
      data.forEach(({ key, value }) => {
        if (key === "call_provider") setCallProvider(value as "twilio" | "vapi");
        if (key === "vapi_phone_number_id") newSettings.phoneNumberId = value;
        if (key === "vapi_caller_id") newSettings.callerId = value;
        if (key === "vapi_assistant_id") newSettings.assistantId = value;
        if (key === "vapi_ai_provider") newSettings.aiProvider = value;
        if (key === "vapi_ai_model") newSettings.aiModel = value;
        if (key === "vapi_temperature") newSettings.temperature = parseFloat(value);
        if (key === "vapi_max_tokens") newSettings.maxTokens = parseInt(value);
        if (key === "vapi_voice_provider") newSettings.voiceProvider = value;
        if (key === "vapi_voice_speed") newSettings.voiceSpeed = parseFloat(value);
        if (key === "vapi_voice_stability") newSettings.voiceStability = parseFloat(value);
        if (key === "vapi_voice_similarity_boost") newSettings.voiceSimilarityBoost = parseFloat(value);
        if (key === "vapi_voice_style") newSettings.voiceStyle = parseFloat(value);
        if (key === "vapi_voice_speaker_boost") newSettings.voiceUseSpeakerBoost = value === "true";
        if (key === "vapi_filler_injection_enabled") newSettings.fillerInjectionEnabled = value === "true";
        if (key === "vapi_transcriber_provider") newSettings.transcriberProvider = value;
        if (key === "vapi_transcriber_model") newSettings.transcriberModel = value;
        if (key === "vapi_transcriber_language") newSettings.transcriberLanguage = value;
        if (key === "vapi_first_message") newSettings.firstMessage = value;
        if (key === "vapi_first_message_mode") newSettings.firstMessageMode = value;
        if (key === "vapi_silence_timeout") newSettings.silenceTimeoutSeconds = parseInt(value);
        if (key === "vapi_max_duration") newSettings.maxDurationSeconds = parseInt(value);
        if (key === "vapi_background_sound") newSettings.backgroundSound = value;
        if (key === "vapi_backchanneling") newSettings.backchannelingEnabled = value === "true";
        if (key === "vapi_end_call_message") newSettings.endCallMessage = value;
        if (key === "vapi_voicemail_message") newSettings.voicemailMessage = value;
        if (key === "vapi_end_call_phrases") newSettings.endCallPhrases = value;
        if (key === "vapi_system_prompt_it") newSettings.systemPromptTemplateIT = value;
        if (key === "vapi_system_prompt_en") newSettings.systemPromptTemplateEN = value;
        if (key === "vapi_first_message_it") newSettings.firstMessageTemplateIT = value;
        if (key === "vapi_first_message_en") newSettings.firstMessageTemplateEN = value;
        if (key === "vapi_start_speaking_wait") newSettings.startSpeakingWaitSeconds = parseFloat(value);
        if (key === "vapi_smart_endpointing_enabled") newSettings.smartEndpointingEnabled = value === "true";
        if (key === "vapi_smart_endpointing_provider") newSettings.smartEndpointingProvider = value;
        if (key === "vapi_transcription_endpointing_enabled") newSettings.transcriptionEndpointingPlanEnabled = value === "true";
        if (key === "vapi_stop_speaking_num_words") newSettings.stopSpeakingNumWords = parseInt(value);
        if (key === "vapi_stop_speaking_voice_seconds") newSettings.stopSpeakingVoiceSeconds = parseFloat(value);
        if (key === "vapi_stop_speaking_backoff_seconds") newSettings.stopSpeakingBackoffSeconds = parseFloat(value);
        if (key === "vapi_smart_denoising_enabled") newSettings.smartDenoisingEnabled = value === "true";
        if (key === "vapi_recording_enabled") newSettings.recordingEnabled = value === "true";
        if (key === "vapi_transcript_enabled") newSettings.transcriptEnabled = value === "true";
        if (key === "vapi_first_message_interruptions") newSettings.firstMessageInterruptionsEnabled = value === "true";
        if (key === "vapi_voicemail_detection") newSettings.voicemailDetectionEnabled = value === "true";
        if (key === "vapi_hipaa_enabled") newSettings.hipaaEnabled = value === "true";
        if (key === "vapi_background_denoising") newSettings.backgroundDenoisingEnabled = value === "true";
        if (key === "vapi_model_output_in_messages") newSettings.modelOutputInMessagesEnabled = value === "true";
        if (key === "elevenlabs_model") setVoiceModels((m) => ({ ...m, elevenlabs: value }));
        if (key === "cartesia_model") setVoiceModels((m) => ({ ...m, cartesia: value }));
        if (key === "openai_tts_model") setVoiceModels((m) => ({ ...m, openai: value }));
        if (key === "playht_model") setVoiceModels((m) => ({ ...m, playht: value }));
        if (key === "azure_tts_model") setVoiceModels((m) => ({ ...m, azure: value }));
        
        // Store initial values for change tracking
        previousSettingsRef.current[key] = value;
      });
      
      // Auto-sync provider from model if provider is not explicitly set or mismatched
      const selectedModel = VAPI_AI_MODELS.find(m => m.value === newSettings.aiModel);
      if (selectedModel && selectedModel.provider !== newSettings.aiProvider) {
        newSettings.aiProvider = selectedModel.provider;
      }
      
      setVapiSettings(newSettings);
    }
  };

  const handleSaveCallProvider = async () => {
    setSavingCallProvider(true);
    try {
      const settingsToSave = [
        { key: "call_provider", value: callProvider },
        { key: "vapi_phone_number_id", value: vapiSettings.phoneNumberId },
        { key: "vapi_caller_id", value: vapiSettings.callerId },
        { key: "vapi_assistant_id", value: vapiSettings.assistantId },
        { key: "vapi_ai_provider", value: vapiSettings.aiProvider },
        { key: "vapi_ai_model", value: vapiSettings.aiModel },
        { key: "vapi_temperature", value: vapiSettings.temperature.toString() },
        { key: "vapi_max_tokens", value: vapiSettings.maxTokens.toString() },
        { key: "vapi_voice_provider", value: vapiSettings.voiceProvider },
        { key: "vapi_voice_speed", value: vapiSettings.voiceSpeed.toString() },
        { key: "vapi_voice_stability", value: vapiSettings.voiceStability.toString() },
        { key: "vapi_voice_similarity_boost", value: vapiSettings.voiceSimilarityBoost.toString() },
        { key: "vapi_voice_style", value: vapiSettings.voiceStyle.toString() },
        { key: "vapi_voice_speaker_boost", value: vapiSettings.voiceUseSpeakerBoost.toString() },
        { key: "vapi_filler_injection_enabled", value: vapiSettings.fillerInjectionEnabled.toString() },
        { key: "vapi_transcriber_provider", value: vapiSettings.transcriberProvider },
        { key: "vapi_transcriber_model", value: vapiSettings.transcriberModel },
        { key: "vapi_transcriber_language", value: vapiSettings.transcriberLanguage },
        { key: "vapi_first_message", value: vapiSettings.firstMessage },
        { key: "vapi_first_message_mode", value: vapiSettings.firstMessageMode },
        { key: "vapi_silence_timeout", value: vapiSettings.silenceTimeoutSeconds.toString() },
        { key: "vapi_max_duration", value: vapiSettings.maxDurationSeconds.toString() },
        { key: "vapi_background_sound", value: vapiSettings.backgroundSound },
        { key: "vapi_backchanneling", value: vapiSettings.backchannelingEnabled.toString() },
        { key: "vapi_end_call_message", value: vapiSettings.endCallMessage },
        { key: "vapi_voicemail_message", value: vapiSettings.voicemailMessage },
        { key: "vapi_end_call_phrases", value: vapiSettings.endCallPhrases },
        { key: "vapi_system_prompt_it", value: vapiSettings.systemPromptTemplateIT },
        { key: "vapi_system_prompt_en", value: vapiSettings.systemPromptTemplateEN },
        { key: "vapi_first_message_it", value: vapiSettings.firstMessageTemplateIT },
        { key: "vapi_first_message_en", value: vapiSettings.firstMessageTemplateEN },
        { key: "vapi_start_speaking_wait", value: vapiSettings.startSpeakingWaitSeconds.toString() },
        { key: "vapi_smart_endpointing_enabled", value: vapiSettings.smartEndpointingEnabled.toString() },
        { key: "vapi_smart_endpointing_provider", value: vapiSettings.smartEndpointingProvider },
        { key: "vapi_transcription_endpointing_enabled", value: vapiSettings.transcriptionEndpointingPlanEnabled.toString() },
        { key: "vapi_stop_speaking_num_words", value: vapiSettings.stopSpeakingNumWords.toString() },
        { key: "vapi_stop_speaking_voice_seconds", value: vapiSettings.stopSpeakingVoiceSeconds.toString() },
        { key: "vapi_stop_speaking_backoff_seconds", value: vapiSettings.stopSpeakingBackoffSeconds.toString() },
        { key: "vapi_smart_denoising_enabled", value: vapiSettings.smartDenoisingEnabled.toString() },
        { key: "vapi_recording_enabled", value: vapiSettings.recordingEnabled.toString() },
        { key: "vapi_transcript_enabled", value: vapiSettings.transcriptEnabled.toString() },
        { key: "vapi_first_message_interruptions", value: vapiSettings.firstMessageInterruptionsEnabled.toString() },
        { key: "vapi_voicemail_detection", value: vapiSettings.voicemailDetectionEnabled.toString() },
        { key: "vapi_hipaa_enabled", value: vapiSettings.hipaaEnabled.toString() },
        { key: "vapi_background_denoising", value: vapiSettings.backgroundDenoisingEnabled.toString() },
        { key: "vapi_model_output_in_messages", value: vapiSettings.modelOutputInMessagesEnabled.toString() },
        { key: "elevenlabs_model", value: voiceModels.elevenlabs },
        { key: "cartesia_model", value: voiceModels.cartesia },
        { key: "openai_tts_model", value: voiceModels.openai },
        { key: "playht_model", value: voiceModels.playht },
        { key: "azure_tts_model", value: voiceModels.azure },
      ];

      // Log all settings being saved
      console.log("=== VOICE CONFIG SAVE ===");
      console.log("Timestamp:", new Date().toISOString());
      console.log("Settings being saved:");
      settingsToSave.forEach(s => {
        console.log(`  ${s.key}: ${s.value}`);
      });

      // Track changes for audit log
      const changes: Array<{ key: string; oldValue: string | null; newValue: string | null }> = [];

      for (const setting of settingsToSave) {
        const oldValue = previousSettingsRef.current[setting.key] || null;
        if (oldValue !== setting.value) {
          changes.push({ key: setting.key, oldValue, newValue: setting.value });
        }
        
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: setting.key, value: setting.value }, { onConflict: "key" });
        if (error) throw error;
      }

      // Log changes to audit table
      if (changes.length > 0) {
        await logBatchChanges(changes);
      }

      // Update previous settings reference
      settingsToSave.forEach(s => {
        previousSettingsRef.current[s.key] = s.value;
      });

      console.log("=== SAVE COMPLETE ===");
      toast({ title: "Salvato!", description: `Provider chiamate: ${callProvider === "vapi" ? "VAPI" : "Twilio/ElevenLabs"}` });
    } catch (error: any) {
      console.error("=== SAVE ERROR ===", error);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setSavingCallProvider(false);
    }
  };

  const handleSaveAiModel = async () => {
    setSavingAiModel(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: aiModel })
        .eq("key", "ai_model");

      if (error) throw error;
      toast({ title: "Salvato!", description: "Modello AI aggiornato" });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setSavingAiModel(false);
    }
  };

  const fetchVoiceSettings = async () => {
    const { data, error } = await supabase
      .from("voice_settings")
      .select("*")
      .order("language", { ascending: true });

    if (!error && data) {
      setVoiceSettings(data as VoiceSetting[]);
    }
  };

  const handleSave = async (setting: VoiceSetting) => {
    // Get original setting for change tracking
    const originalSetting = voiceSettings.find(v => v.id === setting.id);
    
    // Log voice setting being saved
    console.log("=== VOICE SETTING SAVE ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Voice ID:", setting.id);
    console.log("Language:", setting.language);
    console.log("Gender:", setting.gender);
    console.log("ElevenLabs Voice ID:", setting.elevenlabs_voice_id);
    console.log("Voice Name:", setting.voice_name);
    console.log("Rating:", setting.rating || 0);
    console.log("Notes:", setting.notes);

    // Save voice ID, name, notes, rating, and sample audio URL
    const { error } = await supabase
      .from("voice_settings")
      .update({
        elevenlabs_voice_id: setting.elevenlabs_voice_id,
        gender: setting.gender,
        is_active: setting.is_active,
        voice_name: setting.voice_name,
        notes: setting.notes,
        rating: setting.rating || 0,
        sample_audio_url: setting.sample_audio_url || null,
      })
      .eq("id", setting.id);

    if (error) {
      console.error("=== VOICE SETTING SAVE ERROR ===", error);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      console.log("=== VOICE SETTING SAVE COMPLETE ===");
      
      // Log changes to audit table
      const details = { language: setting.language, gender: setting.gender };
      
      if (originalSetting?.elevenlabs_voice_id !== setting.elevenlabs_voice_id) {
        await logVoiceSettingChange("update", "voice_setting_voice_id", originalSetting?.elevenlabs_voice_id || null, setting.elevenlabs_voice_id || null, details);
      }
      if (originalSetting?.voice_name !== setting.voice_name) {
        await logVoiceSettingChange("update", "voice_setting_voice_name", originalSetting?.voice_name || null, setting.voice_name || null, details);
      }
      if (originalSetting?.rating !== setting.rating) {
        await logVoiceSettingChange("update", "voice_setting_rating", String(originalSetting?.rating || 0), String(setting.rating || 0), details);
      }
      if (originalSetting?.notes !== setting.notes) {
        await logVoiceSettingChange("update", "voice_setting_notes", originalSetting?.notes || null, setting.notes || null, details);
      }
      if (originalSetting?.is_active !== setting.is_active) {
        await logVoiceSettingChange("update", "voice_setting_is_active", String(originalSetting?.is_active), String(setting.is_active), details);
      }
      
      toast({ title: "Salvato!", description: "Voce aggiornata" });
      fetchVoiceSettings();
      setSelectedSetting(null);
    }
  };

  const handleAddNew = async () => {
    const existing = voiceSettings.find(
      (v) => v.language === newLanguage && v.gender === newGender
    );

    if (existing) {
      toast({ title: "Errore", description: "Questa combinazione lingua/genere esiste già", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("voice_settings")
      .insert({
        language: newLanguage,
        gender: newGender,
        voice_provider: "elevenlabs",
        elevenlabs_stability: 0.5,
        elevenlabs_similarity: 0.75,
        elevenlabs_style: 0,
        elevenlabs_speed: 1,
      });

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Aggiunto!", description: "Nuova configurazione voce creata" });
      fetchVoiceSettings();
      setIsAddDialogOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("voice_settings")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Eliminato!", description: "Configurazione voce rimossa" });
      fetchVoiceSettings();
      setSelectedSetting(null);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("voice_settings")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: !currentActive ? "Voce attivata" : "Voce disattivata", 
        description: !currentActive ? "La voce è ora disponibile" : "La voce non sarà più disponibile per le chiamate"
      });
      fetchVoiceSettings();
    }
  };

  const handleGenerateSample = async (setting: VoiceSetting) => {
    if (!setting.elevenlabs_voice_id) {
      toast({ title: "Errore", description: "Inserisci prima un Voice ID", variant: "destructive" });
      return;
    }

    setGeneratingSampleId(setting.id);

    try {
      const { data, error } = await supabase.functions.invoke("generate-voice-sample", {
        body: {
          voiceSettingId: setting.id,
          voiceId: setting.elevenlabs_voice_id,
          stability: setting.elevenlabs_stability || 0.5,
          similarity: setting.elevenlabs_similarity || 0.75,
          style: setting.elevenlabs_style || 0,
          speed: setting.elevenlabs_speed || 1,
          language: setting.language,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: "Sample generato!", description: "L'anteprima audio è stata salvata" });
        fetchVoiceSettings();
        setSelectedSetting(null);
      }
    } catch (error: any) {
      console.error("Generate sample error:", error);
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile generare il sample", 
        variant: "destructive" 
      });
    } finally {
      setGeneratingSampleId(null);
    }
  };
  const handleTestVoice = async (setting: VoiceSetting) => {
    if (!setting.elevenlabs_voice_id) {
      toast({ title: "Errore", description: "Inserisci prima un Voice ID", variant: "destructive" });
      return;
    }

    setTestingVoice(true);
    setTestAudioUrl(null);

    try {
      // Use VAPI settings for test (single source of truth)
      const { data, error } = await supabase.functions.invoke("test-voice", {
        body: {
          voiceId: setting.elevenlabs_voice_id,
          stability: vapiSettings.voiceStability,
          similarity: vapiSettings.voiceSimilarityBoost,
          style: vapiSettings.voiceStyle,
          speed: vapiSettings.voiceSpeed,
          language: setting.language,
        },
      });

      if (error) throw error;

      if (data?.audioUrl) {
        setTestAudioUrl(data.audioUrl);
        toast({ title: "Audio generato!", description: "Premi play per ascoltare" });
      }
    } catch (error: any) {
      console.error("Test voice error:", error);
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile generare l'audio di test", 
        variant: "destructive" 
      });
    } finally {
      setTestingVoice(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Shield className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 glass border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-orange-500" />
              <h1 className="font-bold">Configurazione Voci</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
          <div className="space-y-6">
            {/* Backup & Restore */}
            <VapiSnapshotsManager
              onRestored={() => {
                fetchVoiceSettings();
                fetchVapiVoicePresets();
                fetchCallProvider();
                fetchAiModel();
              }}
            />

            {/* Call Provider Selection */}
            <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-500" />
                  Configurazione VAPI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-700 dark:text-green-400">
                  VAPI è il provider esclusivo per le chiamate. Twilio+ElevenLabs è disabilitato ma mantenuto come backup nel codice.
                </div>

                <div className="space-y-6 pt-4">
                {/* Info about Caller IDs */}
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Nota:</strong> I numeri telefonici per VAPI si gestiscono in{" "}
                    <a href="/admin/caller-ids" className="text-primary underline">
                      Admin → Caller IDs
                    </a>. Aggiungi il VAPI Phone Number ID (formato: PN...) al caller ID desiderato.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>VAPI Assistant ID (opzionale)</Label>
                  <Input
                    value={vapiSettings.assistantId}
                    onChange={(e) => setVapiSettings({ ...vapiSettings, assistantId: e.target.value })}
                    placeholder="Usa un assistente pre-configurato"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lascia vuoto per creare dinamicamente
                  </p>
                </div>

                {/* AI Model Section */}
                <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-purple-600">
                    <Brain className="w-4 h-4" />
                    Modello AI
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Modello</Label>
                      <Select 
                        value={vapiSettings.aiModel} 
                        onValueChange={(value) => {
                          // Auto-sync provider based on selected model
                          const selectedModel = VAPI_AI_MODELS.find(m => m.value === value);
                          setVapiSettings({ 
                            ...vapiSettings, 
                            aiModel: value,
                            aiProvider: selectedModel?.provider || 'openai'
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAPI_AI_MODELS.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              <div className="flex flex-col">
                                <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                <span className="text-xs text-muted-foreground">{model.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Provider: <span className="font-medium text-primary">{vapiSettings.aiProvider}</span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Temperature: {vapiSettings.temperature.toFixed(1)}</Label>
                      <Slider
                        value={[vapiSettings.temperature * 100]}
                        onValueChange={([v]) => setVapiSettings({ ...vapiSettings, temperature: v / 100 })}
                        max={100}
                        step={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = preciso, 1 = creativo
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens: {vapiSettings.maxTokens}</Label>
                    <Slider
                      value={[vapiSettings.maxTokens]}
                      onValueChange={([v]) => setVapiSettings({ ...vapiSettings, maxTokens: v })}
                      min={50}
                      max={500}
                      step={10}
                    />
                  </div>
                </div>

                {/* Voice Section */}
                <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-orange-600">
                    <Volume2 className="w-4 h-4" />
                    Voce TTS
                  </h4>
                  
                  {/* Voice Settings from Database - Shows language/gender combos with Voice IDs */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Voci Configurate per Lingua/Genere</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {voiceSettings.map((setting) => (
                        <div 
                          key={setting.id} 
                          className={`p-3 rounded-lg border transition-opacity ${
                            selectedSetting?.id === setting.id 
                              ? 'border-orange-500 bg-orange-500/5' 
                              : setting.is_active === false 
                                ? 'bg-muted/50 opacity-60' 
                                : 'bg-background'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {setting.gender === "male" ? "👨" : "👩"}
                              </span>
                              <span className="font-medium">{setting.language}</span>
                              {setting.voice_name && (
                                <span className="text-sm text-primary font-medium">- {setting.voice_name}</span>
                              )}
                              {/* Star Rating Display */}
                              <div className="flex items-center gap-0.5 ml-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      (setting.rating || 0) >= star 
                                        ? "fill-yellow-400 text-yellow-400" 
                                        : "text-muted-foreground/30"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedSetting(selectedSetting?.id === setting.id ? null : setting)}
                              >
                                {selectedSetting?.id === setting.id ? "Chiudi" : "Modifica"}
                              </Button>
                              <Switch
                                checked={setting.is_active !== false}
                                onCheckedChange={() => handleToggleActive(setting.id, setting.is_active !== false)}
                              />
                            </div>
                          </div>
                          
                          {/* Show Voice ID and notes preview when not editing */}
                          {selectedSetting?.id !== setting.id && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div className="font-mono">
                                Voice ID: {setting.elevenlabs_voice_id || "Non configurato"}
                              </div>
                              {setting.notes && (
                                <div className="italic">📝 {setting.notes}</div>
                              )}
                            </div>
                          )}
                          
                          {/* Edit form when selected */}
                          {selectedSetting?.id === setting.id && (
                            <div className="space-y-3 mt-3 pt-3 border-t">
                              <div className="space-y-2">
                                <Label className="text-xs">Sesso</Label>
                                <Select
                                  value={selectedSetting.gender}
                                  onValueChange={(value) => setSelectedSetting({ ...selectedSetting, gender: value })}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="male">👨 Maschile</SelectItem>
                                    <SelectItem value="female">👩 Femminile</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Nome Voce (opzionale)</Label>
                                <Input
                                  value={selectedSetting.voice_name || ""}
                                  onChange={(e) => setSelectedSetting({ ...selectedSetting, voice_name: e.target.value })}
                                  placeholder="es. Marco Italiano, Giulia Milano..."
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Voice ID ElevenLabs *</Label>
                                <Input
                                  value={selectedSetting.elevenlabs_voice_id || ""}
                                  onChange={(e) => setSelectedSetting({ ...selectedSetting, elevenlabs_voice_id: e.target.value })}
                                  placeholder="Incolla qui il Voice ID da ElevenLabs"
                                  className="h-8 text-sm font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Trova il Voice ID nella{" "}
                                  <a href="https://elevenlabs.io/app/voice-lab" target="_blank" rel="noopener" className="text-primary underline">
                                    ElevenLabs Voice Library
                                  </a>
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Note (opzionale)</Label>
                                <Textarea
                                  value={selectedSetting.notes || ""}
                                  onChange={(e) => setSelectedSetting({ ...selectedSetting, notes: e.target.value })}
                                  placeholder="Annotazioni sulla voce, es. 'Ottima per tono serio', 'Accento napoletano'..."
                                  className="text-sm min-h-[60px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">URL Sample Audio (opzionale)</Label>
                                <Input
                                  value={selectedSetting.sample_audio_url || ""}
                                  onChange={(e) => setSelectedSetting({ ...selectedSetting, sample_audio_url: e.target.value })}
                                  placeholder="https://... (URL diretto a file MP3/WAV)"
                                  className="h-8 text-sm font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Carica un sample audio su un servizio esterno (es. Cloudinary, S3) e incolla l'URL qui
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Valutazione</Label>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => setSelectedSetting({ 
                                        ...selectedSetting, 
                                        rating: selectedSetting.rating === star ? 0 : star 
                                      })}
                                      className="p-1 hover:scale-110 transition-transform"
                                    >
                                      <Star
                                        className={`w-5 h-5 ${
                                          (selectedSetting.rating || 0) >= star 
                                            ? "fill-yellow-400 text-yellow-400" 
                                            : "text-muted-foreground hover:text-yellow-400"
                                        }`}
                                      />
                                    </button>
                                  ))}
                                  {(selectedSetting.rating || 0) > 0 && (
                                    <span className="text-xs text-muted-foreground ml-2">{selectedSetting.rating}/5</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSave(selectedSetting)}
                                  className="flex-1"
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  Salva
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleGenerateSample(selectedSetting)}
                                  disabled={!selectedSetting.elevenlabs_voice_id || generatingSampleId === selectedSetting.id}
                                >
                                  {generatingSampleId === selectedSetting.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Mic className="w-3 h-3 mr-1" />
                                  )}
                                  {generatingSampleId === selectedSetting.id ? "Generando..." : "Genera Sample"}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedSetting(null);
                                    setVoiceTestOpen(true);
                                  }}
                                  disabled={!selectedSetting.elevenlabs_voice_id}
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  Test
                                </Button>
                              </div>
                              {selectedSetting.sample_audio_url && (
                                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                                  <p className="text-xs text-green-500 mb-1">✓ Sample audio disponibile</p>
                                  <audio src={selectedSetting.sample_audio_url} controls className="w-full h-8" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {voiceSettings.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nessuna voce configurata. Aggiungi una combinazione lingua/genere.
                      </p>
                    )}
                  </div>
                  
                  {/* Add New Preset */}
                  <Dialog open={isAddVapiPresetOpen} onOpenChange={setIsAddVapiPresetOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Aggiungi Preset Voce
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nuovo Preset Voce VAPI</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Lingua</Label>
                            <Select 
                              value={newVapiPreset.language} 
                              onValueChange={(value) => setNewVapiPreset({ ...newVapiPreset, language: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LANGUAGES.map((lang) => (
                                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Genere</Label>
                            <Select 
                              value={newVapiPreset.gender} 
                              onValueChange={(value) => setNewVapiPreset({ ...newVapiPreset, gender: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Maschile</SelectItem>
                                <SelectItem value="female">Femminile</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Provider Voce</Label>
                          <Select 
                            value={newVapiPreset.voiceProvider} 
                            onValueChange={(value) => setNewVapiPreset({ ...newVapiPreset, voiceProvider: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VAPI_VOICE_PROVIDERS.map((provider) => (
                                <SelectItem key={provider.value} value={provider.value}>
                                  {provider.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Titolo Voce *</Label>
                          <Input
                            value={newVapiPreset.voice_name}
                            onChange={(e) => setNewVapiPreset({ ...newVapiPreset, voice_name: e.target.value })}
                            placeholder="es. Maschio Italiano - Professionale"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrizione</Label>
                          <Input
                            value={newVapiPreset.description}
                            onChange={(e) => setNewVapiPreset({ ...newVapiPreset, description: e.target.value })}
                            placeholder="Breve descrizione della voce"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Voice ID</Label>
                          {newVapiPreset.voiceProvider === "11labs" ? (
                            <Select 
                              value={newVapiPreset.voiceId} 
                              onValueChange={(value) => setNewVapiPreset({ ...newVapiPreset, voiceId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona una voce" />
                              </SelectTrigger>
                              <SelectContent>
                                {VAPI_ELEVENLABS_VOICES.filter(v => v.value !== "custom").map((voice) => (
                                  <SelectItem key={voice.value} value={voice.value}>
                                    {voice.label} - {voice.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={newVapiPreset.voiceId}
                              onChange={(e) => setNewVapiPreset({ ...newVapiPreset, voiceId: e.target.value })}
                              placeholder="Inserisci Voice ID"
                              className="font-mono text-sm"
                            />
                          )}
                          <p className="text-xs text-muted-foreground">
                            Puoi inserire un Voice ID personalizzato dalla libreria ElevenLabs
                          </p>
                          {newVapiPreset.voiceProvider === "11labs" && (
                            <Input
                              value={newVapiPreset.voiceId}
                              onChange={(e) => setNewVapiPreset({ ...newVapiPreset, voiceId: e.target.value })}
                              placeholder="Oppure inserisci Voice ID manualmente"
                              className="font-mono text-sm mt-2"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Note Interne</Label>
                          <Textarea
                            value={newVapiPreset.notes}
                            onChange={(e) => setNewVapiPreset({ ...newVapiPreset, notes: e.target.value })}
                            placeholder="Note interne visibili solo agli admin..."
                            rows={3}
                          />
                        </div>
                        <Button onClick={handleSaveVapiPreset} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          Salva Preset
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      Impostazioni voce di default (usate se non c'è un preset per lingua/genere)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Provider Voce Default</Label>
                        <Select 
                          value={vapiSettings.voiceProvider} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, voiceProvider: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAPI_VOICE_PROVIDERS.map((provider) => (
                              <SelectItem key={provider.value} value={provider.value}>
                                <div className="flex flex-col">
                                  <span>{provider.label}</span>
                                  <span className="text-xs text-muted-foreground">{provider.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {(() => {
                        const provider = vapiSettings.voiceProvider;
                        const isEleven = provider === "11labs" || provider === "elevenlabs";
                        const isCartesia = provider === "cartesia";
                        const isOpenAI = provider === "openai";
                        const isPlayHT = provider === "playht";
                        const isAzure = provider === "azure";

                        // Provider che hanno un select di modello/voce
                        const modelOptions = isEleven ? ELEVENLABS_MODELS
                          : isCartesia ? CARTESIA_MODELS
                          : isOpenAI ? OPENAI_TTS_MODELS
                          : isPlayHT ? PLAYHT_MODELS
                          : isAzure ? AZURE_TTS_VOICES
                          : null;

                        const label = isEleven ? "Modello ElevenLabs"
                          : isCartesia ? "Modello Cartesia"
                          : isOpenAI ? "Modello OpenAI TTS"
                          : isPlayHT ? "Modello PlayHT"
                          : isAzure ? "Voce Azure Neural"
                          : "Modello";

                        const helper = isEleven ? "Turbo v2.5 è il più veloce."
                          : isCartesia ? "Sonic-3 ha 40ms TTFB e supporto italiano nativo."
                          : isOpenAI ? "gpt-4o-mini-tts è il più espressivo e steerable."
                          : isPlayHT ? "PlayDialog ottimo per conversazioni multi-turno."
                          : isAzure ? "Voci Multilingual supportano IT/EN/ES con la stessa voce."
                          : "Le voci sono gestite nei Preset Voce sopra.";

                        if (!modelOptions) {
                          return (
                            <div className="space-y-2">
                              <Label>Modello</Label>
                              <div className="text-xs text-muted-foreground p-3 rounded border bg-muted/30">
                                Configura modello e voce direttamente nei Preset Voce sopra per il provider <strong>{provider}</strong>.
                              </div>
                            </div>
                          );
                        }

                        // Active provider key for the model state object
                        const providerKey: keyof typeof voiceModels | null =
                          isEleven ? "elevenlabs"
                          : isCartesia ? "cartesia"
                          : isOpenAI ? "openai"
                          : isPlayHT ? "playht"
                          : isAzure ? "azure"
                          : null;

                        return (
                          <div className="space-y-2">
                            <Label>{label}</Label>
                            <Select
                              value={providerKey ? voiceModels[providerKey] : ""}
                              onValueChange={(value) => {
                                if (!providerKey) return;
                                setVoiceModels((m) => ({ ...m, [providerKey]: value }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {modelOptions.map((model: any) => (
                                  <SelectItem key={model.value} value={model.value}>
                                    <div className="flex flex-col">
                                      <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                      <span className="text-xs text-muted-foreground">{model.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{helper} Le voci sono gestite nei Preset Voce sopra.</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Transcriber Section */}
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-blue-600">
                    <Mic className="w-4 h-4" />
                    Trascrizione (STT)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select 
                        value={vapiSettings.transcriberProvider} 
                        onValueChange={(value) => {
                          const modelMap: Record<string, string> = {
                            'deepgram': 'nova-3',
                            'google': 'gemini-2.5-flash',
                            'talkscriber': 'whisper',
                            'gladia': 'fast',
                            'assembly-ai': 'best',
                            'openai': 'whisper-1',
                            'cartesia': 'sonic',
                            'speechmatics': '',
                            '11labs': '',
                            'azure': '',
                            'custom-transcriber': ''
                          };
                          setVapiSettings({ ...vapiSettings, transcriberProvider: value, transcriberModel: modelMap[value] || '' });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAPI_TRANSCRIBER_PROVIDERS.map((provider) => (
                            <SelectItem key={provider.value} value={provider.value}>
                              <div className="flex flex-col">
                                <span className={provider.recommended ? "font-medium" : ""}>{provider.label}</span>
                                <span className="text-xs text-muted-foreground">{provider.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Deepgram Models */}
                    {vapiSettings.transcriberProvider === "deepgram" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEEPGRAM_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Google Models */}
                    {vapiSettings.transcriberProvider === "google" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GOOGLE_STT_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Talkscriber Models */}
                    {vapiSettings.transcriberProvider === "talkscriber" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TALKSCRIBER_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Gladia Models */}
                    {vapiSettings.transcriberProvider === "gladia" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GLADIA_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* AssemblyAI Models */}
                    {vapiSettings.transcriberProvider === "assembly-ai" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSEMBLYAI_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* OpenAI Models */}
                    {vapiSettings.transcriberProvider === "openai" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPENAI_STT_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Cartesia Models */}
                    {vapiSettings.transcriberProvider === "cartesia" && (
                      <div className="space-y-2">
                        <Label>Modello</Label>
                        <Select 
                          value={vapiSettings.transcriberModel} 
                          onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CARTESIA_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex flex-col">
                                  <span className={model.recommended ? "font-medium" : ""}>{model.label}</span>
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Language Selection - Provider specific */}
                    <div className="space-y-2">
                      <Label>Lingua</Label>
                      <Select 
                        value={vapiSettings.transcriberLanguage} 
                        onValueChange={(value) => setVapiSettings({ ...vapiSettings, transcriberLanguage: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {vapiSettings.transcriberProvider === "deepgram" && DEEPGRAM_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "google" && GOOGLE_STT_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "talkscriber" && TALKSCRIBER_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "gladia" && GLADIA_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "assembly-ai" && ASSEMBLYAI_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "azure" && AZURE_STT_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "openai" && OPENAI_STT_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "speechmatics" && SPEECHMATICS_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "cartesia" && CARTESIA_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "11labs" && ELEVENLABS_STT_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                          {vapiSettings.transcriberProvider === "custom-transcriber" && (
                            <>
                              <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                              <SelectItem value="en">🇬🇧 English</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Call Settings Section */}
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-green-600">
                    <Phone className="w-4 h-4" />
                    Impostazioni Chiamata
                  </h4>
                  <div className="space-y-4">
                    {/* ElevenLabs Voice Fine-tuning */}
                    {vapiSettings.voiceProvider === "11labs" && (
                      <div className="p-3 rounded-lg bg-muted/30 space-y-3">
                        <Label className="text-sm font-medium">🎙️ Fine-tuning Voce ElevenLabs</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Stabilità: {(vapiSettings.voiceStability * 100).toFixed(0)}%</Label>
                            <Slider value={[vapiSettings.voiceStability * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, voiceStability: v / 100 })} min={0} max={100} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Similarity: {(vapiSettings.voiceSimilarityBoost * 100).toFixed(0)}%</Label>
                            <Slider value={[vapiSettings.voiceSimilarityBoost * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, voiceSimilarityBoost: v / 100 })} min={0} max={100} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Style: {(vapiSettings.voiceStyle * 100).toFixed(0)}%</Label>
                            <Slider value={[vapiSettings.voiceStyle * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, voiceStyle: v / 100 })} min={0} max={100} step={1} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Speaker Boost</Label>
                            <Button variant={vapiSettings.voiceUseSpeakerBoost ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, voiceUseSpeakerBoost: !vapiSettings.voiceUseSpeakerBoost })}>{vapiSettings.voiceUseSpeakerBoost ? "ON" : "OFF"}</Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Velocità Voce: {vapiSettings.voiceSpeed.toFixed(2)}x</Label>
                      <Slider value={[vapiSettings.voiceSpeed * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, voiceSpeed: v / 100 })} min={25} max={200} step={5} />
                    </div>
                    <div className="space-y-2">
                      <Label>Durata Max: {vapiSettings.maxDurationSeconds}s ({Math.floor(vapiSettings.maxDurationSeconds / 60)}m)</Label>
                      <Slider value={[vapiSettings.maxDurationSeconds]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, maxDurationSeconds: v })} min={60} max={1800} step={30} />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeout Silenzio: {vapiSettings.silenceTimeoutSeconds}s</Label>
                      <Slider value={[vapiSettings.silenceTimeoutSeconds]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, silenceTimeoutSeconds: v })} min={10} max={120} step={5} />
                    </div>
                    {/* Start Speaking Plan */}
                    <div className="p-3 rounded-lg bg-muted/30 space-y-3">
                      <Label className="text-sm font-medium">🗣️ Start Speaking Plan</Label>
                      <div className="space-y-2">
                        <Label className="text-xs">Attesa prima di parlare: {vapiSettings.startSpeakingWaitSeconds.toFixed(2)}s</Label>
                        <Slider value={[vapiSettings.startSpeakingWaitSeconds * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, startSpeakingWaitSeconds: v / 100 })} min={0} max={200} step={5} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Smart Endpointing</Label>
                        <Button variant={vapiSettings.smartEndpointingEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, smartEndpointingEnabled: !vapiSettings.smartEndpointingEnabled })}>{vapiSettings.smartEndpointingEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      {vapiSettings.smartEndpointingEnabled && (
                        <Select value={vapiSettings.smartEndpointingProvider} onValueChange={(v) => setVapiSettings({ ...vapiSettings, smartEndpointingProvider: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="livekit">LiveKit (Inglese)</SelectItem>
                            <SelectItem value="vapi">VAPI (Multi-lingua)</SelectItem>
                            <SelectItem value="krisp">Krisp (Audio-based)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    {/* Stop Speaking Plan */}
                    <div className="p-3 rounded-lg bg-muted/30 space-y-3">
                      <Label className="text-sm font-medium">🛑 Stop Speaking Plan</Label>
                      <div className="space-y-2">
                        <Label className="text-xs">Parole per interrompere: {vapiSettings.stopSpeakingNumWords}</Label>
                        <Slider value={[vapiSettings.stopSpeakingNumWords]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, stopSpeakingNumWords: v })} min={0} max={10} step={1} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Voice Detection: {vapiSettings.stopSpeakingVoiceSeconds.toFixed(2)}s</Label>
                        <Slider value={[vapiSettings.stopSpeakingVoiceSeconds * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, stopSpeakingVoiceSeconds: v / 100 })} min={0} max={100} step={5} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Backoff: {vapiSettings.stopSpeakingBackoffSeconds.toFixed(2)}s</Label>
                        <Slider value={[vapiSettings.stopSpeakingBackoffSeconds * 100]} onValueChange={([v]) => setVapiSettings({ ...vapiSettings, stopSpeakingBackoffSeconds: v / 100 })} min={0} max={300} step={10} />
                      </div>
                    </div>
                    {/* Advanced Toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Filler Words (uhm, eh)</Label>
                        <Button variant={vapiSettings.fillerInjectionEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, fillerInjectionEnabled: !vapiSettings.fillerInjectionEnabled })}>{vapiSettings.fillerInjectionEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Backchanneling</Label>
                        <Button variant={vapiSettings.backchannelingEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, backchannelingEnabled: !vapiSettings.backchannelingEnabled })}>{vapiSettings.backchannelingEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">First Msg Interrupts</Label>
                        <Button variant={vapiSettings.firstMessageInterruptionsEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, firstMessageInterruptionsEnabled: !vapiSettings.firstMessageInterruptionsEnabled })}>{vapiSettings.firstMessageInterruptionsEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Voicemail Detection</Label>
                        <Button variant={vapiSettings.voicemailDetectionEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, voicemailDetectionEnabled: !vapiSettings.voicemailDetectionEnabled })}>{vapiSettings.voicemailDetectionEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Smart Denoising (Krisp)</Label>
                        <Button variant={vapiSettings.smartDenoisingEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, smartDenoisingEnabled: !vapiSettings.smartDenoisingEnabled })}>{vapiSettings.smartDenoisingEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Background Denoising</Label>
                        <Button variant={vapiSettings.backgroundDenoisingEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, backgroundDenoisingEnabled: !vapiSettings.backgroundDenoisingEnabled })}>{vapiSettings.backgroundDenoisingEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Recording</Label>
                        <Button variant={vapiSettings.recordingEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, recordingEnabled: !vapiSettings.recordingEnabled })}>{vapiSettings.recordingEnabled ? "ON" : "OFF"}</Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <Label className="text-xs">Transcript</Label>
                        <Button variant={vapiSettings.transcriptEnabled ? "default" : "outline"} size="sm" onClick={() => setVapiSettings({ ...vapiSettings, transcriptEnabled: !vapiSettings.transcriptEnabled })}>{vapiSettings.transcriptEnabled ? "ON" : "OFF"}</Button>
                      </div>
                    </div>
                    {/* Call Messages & Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Modalità Primo Messaggio</Label>
                        <Select value={vapiSettings.firstMessageMode} onValueChange={(value) => setVapiSettings({ ...vapiSettings, firstMessageMode: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assistant-speaks-first">Assistente parla prima</SelectItem>
                            <SelectItem value="assistant-waits-for-user">Attende l'utente</SelectItem>
                            <SelectItem value="assistant-speaks-first-with-model-generated-message">Messaggio generato dal modello</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Suono di Sottofondo</Label>
                        <Select value={vapiSettings.backgroundSound} onValueChange={(value) => setVapiSettings({ ...vapiSettings, backgroundSound: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="off">Nessuno</SelectItem>
                            <SelectItem value="office">Ufficio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Messaggio Fine Chiamata</Label>
                        <Input value={vapiSettings.endCallMessage} onChange={(e) => setVapiSettings({ ...vapiSettings, endCallMessage: e.target.value })} placeholder="Arrivederci!" />
                      </div>
                      <div className="space-y-2">
                        <Label>Messaggio Segreteria</Label>
                        <Input value={vapiSettings.voicemailMessage} onChange={(e) => setVapiSettings({ ...vapiSettings, voicemailMessage: e.target.value })} placeholder="Lascia vuoto per riagganciare" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Frasi Fine Chiamata</Label>
                      <Input value={vapiSettings.endCallPhrases} onChange={(e) => setVapiSettings({ ...vapiSettings, endCallPhrases: e.target.value })} placeholder="arrivederci, ciao ciao, a presto (separate da virgola)" />
                      <p className="text-xs text-muted-foreground">Frasi che se dette dall'AI terminano la chiamata (case insensitive)</p>
                    </div>
                  </div>
                </div>

                {/* First Message Template Section */}
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-green-600">
                    <Phone className="w-4 h-4" />
                    First Message Template
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Template per il primo messaggio dell'AI. Placeholder disponibili: <code className="bg-muted px-1 rounded">{"{{GREETING}}"}</code> (Buongiorno/Buonasera), <code className="bg-muted px-1 rounded">{"{{VICTIM_NAME}}"}</code>, <code className="bg-muted px-1 rounded">{"{{VICTIM_FIRST_NAME}}"}</code>, <code className="bg-muted px-1 rounded">{"{{PRANK_THEME}}"}</code>
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        🇮🇹 First Message Italiano
                      </Label>
                      <Textarea
                        value={vapiSettings.firstMessageTemplateIT}
                        onChange={(e) => setVapiSettings({ ...vapiSettings, firstMessageTemplateIT: e.target.value })}
                        placeholder="Primo messaggio per chiamate in italiano..."
                        rows={3}
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setVapiSettings({ ...vapiSettings, firstMessageTemplateIT: DEFAULT_FIRST_MESSAGE_IT })}
                      >
                        Ripristina Default
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        🇬🇧 First Message English
                      </Label>
                      <Textarea
                        value={vapiSettings.firstMessageTemplateEN}
                        onChange={(e) => setVapiSettings({ ...vapiSettings, firstMessageTemplateEN: e.target.value })}
                        placeholder="First message for English calls..."
                        rows={3}
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setVapiSettings({ ...vapiSettings, firstMessageTemplateEN: DEFAULT_FIRST_MESSAGE_EN })}
                      >
                        Restore Default
                      </Button>
                    </div>
                  </div>
                </div>

                {/* System Prompt Section */}
                <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-orange-600">
                    <Brain className="w-4 h-4" />
                    System Prompt Template
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Template per il system prompt dell'AI. Placeholder disponibili: <code className="bg-muted px-1 rounded">{"{{GENDER}}"}</code> (un uomo/una donna), <code className="bg-muted px-1 rounded">{"{{VICTIM_NAME}}"}</code>, <code className="bg-muted px-1 rounded">{"{{VICTIM_GENDER}}"}</code> (maschio/femmina), <code className="bg-muted px-1 rounded">{"{{PRANK_THEME}}"}</code>, <code className="bg-muted px-1 rounded">{"{{PERSONALITY_TONE}}"}</code>, <code className="bg-muted px-1 rounded">{"{{REAL_DETAIL}}"}</code> (dettaglio opzionale), <code className="bg-muted px-1 rounded">{"{{REAL_DETAIL_SECTION}}"}</code> (sezione completa se presente)
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        🇮🇹 Template Italiano
                      </Label>
                      <Textarea
                        value={vapiSettings.systemPromptTemplateIT}
                        onChange={(e) => setVapiSettings({ ...vapiSettings, systemPromptTemplateIT: e.target.value })}
                        placeholder="System prompt per chiamate in italiano..."
                        rows={12}
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setVapiSettings({ ...vapiSettings, systemPromptTemplateIT: DEFAULT_SYSTEM_PROMPT_IT })}
                      >
                        Ripristina Default
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        🇬🇧 Template English
                      </Label>
                      <Textarea
                        value={vapiSettings.systemPromptTemplateEN}
                        onChange={(e) => setVapiSettings({ ...vapiSettings, systemPromptTemplateEN: e.target.value })}
                        placeholder="System prompt for English calls..."
                        rows={12}
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setVapiSettings({ ...vapiSettings, systemPromptTemplateEN: DEFAULT_SYSTEM_PROMPT_EN })}
                      >
                        Restore Default
                      </Button>
                    </div>
                  </div>
                </div>
            </div>

            <Button onClick={handleSaveCallProvider} disabled={savingCallProvider} className="w-full">
              {savingCallProvider ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salva Provider
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Note: Twilio+ElevenLabs sections removed - VAPI is the exclusive provider */}
        {/* Twilio code is kept in edge functions as backup but UI is disabled */}
          </div>
          
          {/* Audit Log Sidebar */}
          <div className="hidden lg:block sticky top-20 h-fit">
            <VoiceSettingsAuditLog />
          </div>
        </div>
      </main>

      {/* Voice Test Dialog */}
      {selectedSetting && (
        <VoiceTestDialog
          open={voiceTestOpen}
          onOpenChange={setVoiceTestOpen}
          language={selectedSetting.language}
          gender={selectedSetting.gender}
          voiceId={selectedSetting.elevenlabs_voice_id}
          personality="friendly"
          elevenlabsSettings={{
            stability: selectedSetting.elevenlabs_stability * 100,
            similarity: selectedSetting.elevenlabs_similarity * 100,
            style: selectedSetting.elevenlabs_style * 100,
            speed: selectedSetting.elevenlabs_speed
          }}
        />
      )}
    </div>
  );
};

export default AdminVoices;
