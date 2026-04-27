import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Phone, User, Mic, Globe, Send, Loader2, Check, ShieldAlert, AlertTriangle, MessageSquare } from "lucide-react";
import VoiceCard from "@/components/VoiceCard";
import saranoIcon from "@/assets/sarano-icon.png";
import { z } from "zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import PrankDisclaimerModal from "@/components/PrankDisclaimerModal";
import { normalizeE164, extractNationalDigits } from "@/lib/phone";

const normalizePhoneDigits = (value: string) => value.replace(/\D/g, "");

const COUNTRY_CODES = [
  { code: "+39", country: "IT", flag: "🇮🇹", name: "Italia" },
  { code: "+49", country: "DE", flag: "🇩🇪", name: "Germania" },
  { code: "+33", country: "FR", flag: "🇫🇷", name: "Francia" },
  { code: "+34", country: "ES", flag: "🇪🇸", name: "Spagna" },
  { code: "+44", country: "GB", flag: "🇬🇧", name: "Regno Unito" },
  { code: "+41", country: "CH", flag: "🇨🇭", name: "Svizzera" },
  { code: "+43", country: "AT", flag: "🇦🇹", name: "Austria" },
  { code: "+31", country: "NL", flag: "🇳🇱", name: "Paesi Bassi" },
  { code: "+32", country: "BE", flag: "🇧🇪", name: "Belgio" },
  { code: "+351", country: "PT", flag: "🇵🇹", name: "Portogallo" },
  { code: "+48", country: "PL", flag: "🇵🇱", name: "Polonia" },
  { code: "+30", country: "GR", flag: "🇬🇷", name: "Grecia" },
];

const TONES = [
  { value: "enthusiastic", label: "Entusiasta 🎉" },
  { value: "serious", label: "Serio 😐" },
  { value: "angry", label: "Arrabbiato 😠" },
  { value: "confused", label: "Confuso 🤔" },
  { value: "mysterious", label: "Misterioso 🕵️" },
  { value: "friendly", label: "Amichevole 😊" },
  { value: "sexy", label: "Sexy 😏" },
];

const STEPS = [
  { id: 1, title: "Vittima", icon: User },
  { id: 2, title: "Tema", icon: Mic },
  { id: 3, title: "Voce", icon: Globe },
  { id: 4, title: "Riepilogo", icon: Check },
];

interface PrankPreset {
  id: string;
  title: string;
  theme: string;
  icon: string;
}

interface VoiceOption {
  id: string;
  voice_name: string | null;
  description: string | null;
  elevenlabs_voice_id: string | null;
  elevenlabs_stability: number | null;
  elevenlabs_similarity: number | null;
  elevenlabs_style: number | null;
  elevenlabs_speed: number | null;
  gender: string;
  language: string;
  sample_audio_url: string | null;
}

interface UserProfile {
  available_pranks: number;
  trial_prank_used: boolean;
  phone_verified: boolean;
  phone_number: string | null;
  card_verified: boolean;
}

const CreatePrank = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingPrank, setLoadingPrank] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [presets, setPresets] = useState<PrankPreset[]>([]);
  const [allVoices, setAllVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [victimFirstName, setVictimFirstName] = useState("");
  const [victimLastName, setVictimLastName] = useState("");
  const [victimGender, setVictimGender] = useState("male");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+39");
  const [victimPhone, setVictimPhone] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("custom");
  const [prankTheme, setPrankTheme] = useState("");
  const [realDetail, setRealDetail] = useState("");
  const [personalityTone, setPersonalityTone] = useState("enthusiastic");
  const [maxDuration] = useState(300);
  const [creativityLevel] = useState([50]);
  const sendRecording = true;
  const [sendRevealSms, setSendRevealSms] = useState(true);
  const [revealSenderName, setRevealSenderName] = useState("");
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [pendingPrankId, setPendingPrankId] = useState<string | null>(null);
  const [contentCheckLoading, setContentCheckLoading] = useState(false);
  const [contentBlocked, setContentBlocked] = useState<{ blocked: boolean; message: string; category?: string } | null>(null);
  const submitLockedRef = useRef(false);
  const confirmLockedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("available_pranks, trial_prank_used, phone_verified, phone_number, card_verified")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      setProfile({
        available_pranks: data.available_pranks || 0,
        trial_prank_used: data.trial_prank_used || false,
        phone_verified: data.phone_verified || false,
        phone_number: data.phone_number,
        card_verified: data.card_verified || false,
      });
    }
  };

  // Check if user can make a prank call
  const canMakePrank = (): { allowed: boolean; isTrialCall: boolean; reason?: string } => {
    if (!profile) return { allowed: false, isTrialCall: false, reason: "Caricamento profilo..." };
    
    // Has paid pranks available
    if (profile.available_pranks > 0) {
      return { allowed: true, isTrialCall: false };
    }
    
    // Trial not used + phone verified = can call ANY number (no card needed)
    if (!profile.trial_prank_used && profile.phone_verified) {
      return { allowed: true, isTrialCall: true };
    }
    
    // No pranks and trial used
    if (profile.trial_prank_used) {
      return { allowed: false, isTrialCall: false, reason: "Hai esaurito i prank disponibili. Acquista un pacchetto per continuare!" };
    }
    
    // Phone not verified
    if (!profile.phone_verified) {
      return { allowed: false, isTrialCall: false, reason: "Verifica il tuo numero di telefono per ottenere un prank gratuito!" };
    }
    
    return { allowed: false, isTrialCall: false, reason: "Nessun prank disponibile" };
  };

  useEffect(() => {
    fetchPresets();
    fetchAllVoices();
  }, []);

  useEffect(() => {
    const repeatId = searchParams.get("repeat");
    const quickCallId = searchParams.get("quickCall");
    const addThemeParam = searchParams.get("addTheme");
    const phoneParam = searchParams.get("phone");
    const firstNameParam = searchParams.get("firstName");
    const lastNameParam = searchParams.get("lastName");
    const themeParam = searchParams.get("theme");
    const stepParam = searchParams.get("step");
    
    if (repeatId && user?.id) {
      setLoadingPrank(true);
      loadPrankData(repeatId).then(() => {
        // Skip directly to summary step when repeating
        setCurrentStep(4);
      }).finally(() => setLoadingPrank(false));
    } else if (quickCallId && user?.id) {
      // Quick call: load prank data but override theme with addTheme
      setLoadingPrank(true);
      loadPrankData(quickCallId).then(() => {
        // Override the theme with the quick call text
        if (addThemeParam) {
          setRealDetail(addThemeParam);
        }
        // Skip directly to summary step
        setCurrentStep(4);
      }).finally(() => setLoadingPrank(false));
    } else if (phoneParam) {
      if (firstNameParam) setVictimFirstName(firstNameParam);
      if (lastNameParam) setVictimLastName(lastNameParam);
      
      if (themeParam) {
        setPrankTheme(themeParam);
        setSelectedPreset("custom");
      }
      
      if (addThemeParam) {
        setRealDetail(addThemeParam);
      }
      
      const matchedCountry = COUNTRY_CODES.find(c => phoneParam.startsWith(c.code));
      if (matchedCountry) {
        const { dialCode, nationalDigits } = extractNationalDigits(phoneParam, matchedCountry.code);
        setPhoneCountryCode(dialCode);
        setVictimPhone(nationalDigits);
      } else {
        setVictimPhone(phoneParam);
      }
      
      if (stepParam) {
        setCurrentStep(parseInt(stepParam, 10));
      }
    }
  }, [searchParams, user?.id]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const fetchPresets = async () => {
    const { data } = await supabase
      .from("prank_presets")
      .select("id, title, theme, icon")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (data) {
      setPresets(data);
    }
  };

  const fetchAllVoices = async () => {
    const { data } = await supabase
      .from("voice_settings")
      .select("id, voice_name, description, elevenlabs_voice_id, elevenlabs_stability, elevenlabs_similarity, elevenlabs_style, elevenlabs_speed, gender, language, sample_audio_url")
      .eq("is_active", true)
      .order("gender", { ascending: true });

    if (data && data.length > 0) {
      setAllVoices(data);
      if (!selectedVoiceId) {
        setSelectedVoiceId(data[0].id);
      }
    }
  };

  const maleVoices = allVoices.filter(v => v.gender === "male");
  const femaleVoices = allVoices.filter(v => v.gender === "female");

  const playVoicePreview = async (voice: VoiceOption) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setLoadingPreviewId(voice.id);

    try {
      let audioUrl: string | null = null;
      
      // Use saved sample if available
      if (voice.sample_audio_url) {
        audioUrl = voice.sample_audio_url;
      } else {
        // Fallback to generating audio via API (may fail if ElevenLabs limit reached)
        const { data, error } = await supabase.functions.invoke("test-voice", {
          body: {
            voiceId: voice.elevenlabs_voice_id,
            stability: voice.elevenlabs_stability || 0.5,
            similarity: voice.elevenlabs_similarity || 0.75,
            style: voice.elevenlabs_style || 0,
            speed: voice.elevenlabs_speed || 1,
            language: voice.language,
          }
        });

        if (error) throw error;
        audioUrl = data?.audioUrl;
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setPlayingVoiceId(null);
          audioRef.current = null;
        };
        
        audio.onerror = () => {
          setPlayingVoiceId(null);
          audioRef.current = null;
          toast({ title: "Errore", description: "Impossibile riprodurre l'audio", variant: "destructive" });
        };

        await audio.play();
        setPlayingVoiceId(voice.id);
      } else {
        throw new Error("Nessun audio disponibile");
      }
    } catch (error: any) {
      console.error("Voice preview error:", error);
      toast({ title: "Errore", description: "Anteprima non disponibile. Aggiungi un sample audio dalla pagina admin.", variant: "destructive" });
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId !== "custom") {
      const preset = presets.find(p => p.id === presetId);
      if (preset) {
        setPrankTheme(preset.theme);
      }
    }
  };

  const loadPrankData = async (prankId: string) => {
    try {
      if (!user?.id) return;
      
      // Use RPC to get decrypted prank data (victim_phone, names are encrypted in pranks table)
      const { data: allPranks, error } = await supabase.rpc("get_user_pranks_decrypted");
      
      if (error) {
        console.error("Error loading prank:", error);
        toast({ title: "Errore", description: "Impossibile caricare lo scherzo", variant: "destructive" });
        return;
      }
      
      const data = allPranks?.find((p: any) => p.id === prankId);

      if (error) {
        console.error("Error loading prank:", error);
        toast({ title: "Errore", description: "Impossibile caricare lo scherzo", variant: "destructive" });
        return;
      }

      if (data) {
        setVictimFirstName(data.victim_first_name);
        setVictimLastName(data.victim_last_name);
        const phone = data.victim_phone;
        const matchedCountry = COUNTRY_CODES.find(c => phone.startsWith(c.code));
        if (matchedCountry) {
          const { dialCode, nationalDigits } = extractNationalDigits(phone, matchedCountry.code);
          setPhoneCountryCode(dialCode);
          setVictimPhone(nationalDigits);
        } else {
          setVictimPhone(phone);
        }
        setPrankTheme(data.prank_theme);
        setPersonalityTone(data.personality_tone);
        
        if (data.elevenlabs_voice_id) {
          const { data: voiceData } = await supabase
            .from("voice_settings")
            .select("id")
            .eq("elevenlabs_voice_id", data.elevenlabs_voice_id)
            .eq("is_active", true)
            .maybeSingle();
          
          if (voiceData) {
            setSelectedVoiceId(voiceData.id);
          }
        }
      }
    } catch (err) {
      console.error("Error in loadPrankData:", err);
      toast({ title: "Errore", description: "Errore nel caricamento", variant: "destructive" });
    }
  };

  // Trial user check is no longer needed for phone restriction since trial allows any number
  const isTrialUserWithWrongNumber = (): boolean => {
    return false; // No longer restrict trial to own number
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!victimFirstName.trim()) {
          toast({ title: "Errore", description: "Inserisci il nome della vittima", variant: "destructive" });
          return false;
        }
        {
          const phoneCheck = normalizeE164(victimPhone, phoneCountryCode);
          if (!phoneCheck.isValid) {
            toast({
              title: "Numero non valido",
              description: `Controlla il numero per ${phoneCountryCode}. Esempio: 333 1234567`,
              variant: "destructive",
            });
            return false;
          }
        }
        // No longer restrict trial to own phone number — trial allows any number
        // Block if trial already used and no pranks
        if (profile && profile.available_pranks === 0 && profile.trial_prank_used) {
          toast({ 
            title: "Nessun prank disponibile", 
            description: "Hai esaurito i prank disponibili. Acquista un pacchetto per continuare!", 
            variant: "destructive" 
          });
          return false;
        }
        return true;
      case 2:
        if (!prankTheme.trim()) {
          toast({ title: "Errore", description: "Descrivi il tema dello scherzo", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        if (!selectedVoiceId) {
          toast({ title: "Errore", description: "Seleziona una voce", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      // Check content with AI on step 2 (when going from theme to voice)
      if (currentStep === 2 && selectedPreset === "custom") {
        setContentCheckLoading(true);
        setContentBlocked(null);
        
        try {
          const { data, error } = await supabase.functions.invoke("check-prank-content", {
            body: { 
              prankTheme, 
              realDetail,
              language: "Italiano"
            }
          });
          
          if (error) {
            console.error("Content check error:", error);
            // Fail open - allow to proceed if check fails
          } else if (data?.blocked) {
            setContentBlocked({
              blocked: true,
              message: data.message || "Contenuto non appropriato",
              category: data.category
            });
            setContentCheckLoading(false);
            return; // Don't proceed
          }
        } catch (err) {
          console.error("Content check failed:", err);
          // Fail open - allow to proceed
        }
        
        setContentCheckLoading(false);
      }
      
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (submitLockedRef.current || loading || pendingPrankId) return;
    if (!user || !profile) return;

    // Check if user can make this prank
    const prankCheck = canMakePrank();
    const isTrialCall = prankCheck.isTrialCall;
    if (!prankCheck.allowed) {
      toast({ 
        title: "Non puoi fare questo scherzo", 
        description: prankCheck.reason, 
        variant: "destructive" 
      });
      if (prankCheck.reason?.includes("Acquista")) {
        navigate("/pricing");
      } else if (prankCheck.reason?.includes("Verifica")) {
        navigate("/verify-phone");
      }
      return;
    }

    submitLockedRef.current = true;
    setLoading(true);

    try {
      const selectedVoice = allVoices.find(v => v.id === selectedVoiceId);
      
      const { data: voiceSettings } = selectedVoiceId && selectedVoiceId.length > 0
        ? await supabase
            .from("voice_settings")
            .select("*")
            .eq("id", selectedVoiceId)
            .single()
        : { data: null };
      
      // Reveal SMS is always mandatory - store just the display name
      const effectiveRevealName = revealSenderName.trim() || "";

      const { data: prank, error } = await supabase
        .from("pranks")
        .insert({
          user_id: user.id,
          victim_first_name: victimFirstName.trim(),
          victim_last_name: victimLastName.trim(),
          victim_gender: victimGender,
          victim_phone: normalizeE164(victimPhone, phoneCountryCode).e164 ?? `${phoneCountryCode}${normalizePhoneDigits(victimPhone)}`,
          prank_theme: prankTheme.trim(),
          real_detail: realDetail.trim() || null,
          voice_gender: voiceSettings?.gender || "male",
          voice_provider: voiceSettings?.voice_provider || "elevenlabs",
          elevenlabs_stability: voiceSettings?.elevenlabs_stability || 0.5,
          elevenlabs_similarity: voiceSettings?.elevenlabs_similarity || 0.75,
          elevenlabs_style: voiceSettings?.elevenlabs_style || 0,
          elevenlabs_speed: voiceSettings?.elevenlabs_speed || 1,
          elevenlabs_voice_id: voiceSettings?.elevenlabs_voice_id || null,
          language: voiceSettings?.language || "Italiano",
          personality_tone: personalityTone,
          max_duration: maxDuration,
          creativity_level: creativityLevel[0],
          send_recording: sendRecording,
          send_reveal_sms: true,
          reveal_sender_name: effectiveRevealName,
          call_status: "pending",
          scheduled_at: null,
        })
        .select()
        .single();

      if (error) throw error;

      // Store the prank ID and show disclaimer modal
      setPendingPrankId(prank.id);
      setShowDisclaimerModal(true);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      submitLockedRef.current = false;
      setLoading(false);
    }
  };

  const handleDisclaimerConfirm = async () => {
    if (confirmLockedRef.current || !pendingPrankId || !user || !profile) return;
    const prankId = pendingPrankId;

    const prankCheck = canMakePrank();
    const isTrialCall = prankCheck.isTrialCall;

    confirmLockedRef.current = true;
    setLoading(true);
    try {
      toast({
        title: "Scherzo confermato! 🎭",
        description: "Avvio della chiamata in corso...",
      });

      const { error: callError } = await supabase.functions.invoke("initiate-call-vapi", {
        body: { prankId }
      });

      if (callError) {
        console.error('Error initiating call:', callError);
        await supabase
          .from("pranks")
          .update({ call_status: "failed" })
          .eq("id", prankId);
        
        toast({
          title: "Errore chiamata",
          description: callError.message || "Nessun numero attivo configurato. Contatta l'amministratore.",
          variant: "destructive",
        });
      } else {
        // Trial marking is now handled server-side in initiate-call-vapi
        // to prevent infinite retry exploits
        
        toast({
          title: "Chiamata avviata! 📞",
          description: `Stiamo chiamando ${victimFirstName}...`,
        });
      }

      setPendingPrankId(null);
      setShowDisclaimerModal(false);
      navigate(`/prank/${prankId}`);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      confirmLockedRef.current = false;
      setLoading(false);
    }
  };

  const selectedVoice = allVoices.find(v => v.id === selectedVoiceId);
  const selectedCountry = COUNTRY_CODES.find(c => c.code === phoneCountryCode);

  if (loadingPrank) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Caricamento scherzo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <img 
            src={saranoIcon} 
            alt="sarano.ai" 
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain" 
          />
          <div>
            <h1 className="font-bold text-sm sm:text-base">Crea Scherzo</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Step {currentStep} di 4</p>
          </div>
        </div>
      </header>

      {/* Progress Bar - Compact on mobile */}
      <div className="px-3 py-2 sm:px-4 sm:py-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep >= step.id 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <step.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </div>
                <span className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium ${
                  currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 rounded-full transition-all duration-300 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="px-3 sm:px-4 max-w-lg mx-auto">
        {/* Step 1: Victim Info */}
        {currentStep === 1 && (
          <Card className="animate-fade-in">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Chi vuoi chiamare?</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Inserisci i dati della vittima</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="firstName" className="text-xs sm:text-sm">Nome</Label>
                  <Input
                    id="firstName"
                    placeholder="Mario"
                    value={victimFirstName}
                    onChange={(e) => setVictimFirstName(e.target.value)}
                    className="h-10 sm:h-12 text-sm"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="lastName" className="text-xs sm:text-sm">Cognome <span className="text-muted-foreground text-[10px] sm:text-xs font-normal">(opz.)</span></Label>
                  <Input
                    id="lastName"
                    placeholder="Rossi"
                    value={victimLastName}
                    onChange={(e) => setVictimLastName(e.target.value)}
                    className="h-10 sm:h-12 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Sesso Vittima</Label>
                <Select value={victimGender} onValueChange={setVictimGender}>
                  <SelectTrigger className="h-10 sm:h-12 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Maschio 👨</SelectItem>
                    <SelectItem value="female">Femmina 👩</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Per l'italiano (es. "caro" vs "cara")</p>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="phone" className="text-xs sm:text-sm">Numero di Telefono</Label>
                <div className="flex gap-1.5 sm:gap-2">
                  <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                    <SelectTrigger className="w-[100px] sm:w-[130px] h-10 sm:h-12 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="333 1234567"
                      value={victimPhone}
                      onChange={(e) => setVictimPhone(e.target.value)}
                      className="pl-8 sm:pl-10 h-10 sm:h-12 text-sm"
                    />
                  </div>
                </div>
                {victimPhone.trim() && (() => {
                  const check = normalizeE164(victimPhone, phoneCountryCode);
                  return check.isValid ? (
                    <p className="text-xs text-green-500 mt-1.5 font-mono">
                      ✅ Chiamerai: {check.formatted}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive mt-1.5">
                      ⚠️ Numero non valido per {phoneCountryCode}. Inserisci solo il numero senza prefisso (es. 333 1234567).
                    </p>
                  );
                })()}
              </div>
              {/* Trial prank available */}
              {profile && profile.available_pranks === 0 && !profile.trial_prank_used && profile.phone_verified && (
                <div className="p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-xs sm:text-sm text-green-500 font-medium">
                    🎁 Hai 1 prank gratuito! Puoi chiamare qualsiasi numero.
                  </p>
                </div>
              )}
              {profile && profile.available_pranks === 0 && profile.trial_prank_used && (
                <div className="p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <p className="text-xs sm:text-sm text-destructive font-medium">
                    ❌ Hai esaurito i prank disponibili
                  </p>
                  <Button 
                    variant="link" 
                    className="text-primary p-0 h-auto text-xs sm:text-sm mt-1"
                    onClick={() => navigate("/pricing")}
                  >
                    Acquista un pacchetto →
                  </Button>
                </div>
              )}
              {profile && profile.available_pranks === 0 && !profile.trial_prank_used && !profile.phone_verified && (
                <div className="p-2 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="text-xs sm:text-sm text-blue-500 font-medium">
                    📱 Verifica il numero per 1 prank gratuito!
                  </p>
                  <Button 
                    variant="link" 
                    className="text-blue-500 p-0 h-auto text-xs sm:text-sm"
                    onClick={() => navigate("/verify-phone")}
                  >
                    Verifica ora →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Prank Theme */}
        {currentStep === 2 && (
          <Card className="animate-fade-in">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-secondary/10">
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Cosa vuoi far dire all'AI?</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Descrivi il tema dello scherzo</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 space-y-3 sm:space-y-4">
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs sm:text-sm">Scegli un preset o scrivi il tuo</Label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button
                    type="button"
                    variant={selectedPreset === "custom" ? "default" : "outline"}
                    size="sm"
                    className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${selectedPreset === "custom" ? "gradient-primary" : ""}`}
                    onClick={() => handlePresetChange("custom")}
                  >
                    ✏️ Personalizzato
                  </Button>
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant={selectedPreset === preset.id ? "default" : "outline"}
                      size="sm"
                      className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${selectedPreset === preset.id ? "gradient-primary" : ""}`}
                      onClick={() => handlePresetChange(preset.id)}
                    >
                      {preset.icon} {preset.title}
                    </Button>
                  ))}
                </div>
                <Textarea
                  placeholder="Descrivi lo scherzo che vuoi fare..."
                  value={prankTheme}
                  onChange={(e) => {
                    setPrankTheme(e.target.value);
                    setContentBlocked(null);
                    if (selectedPreset !== "custom") {
                      setSelectedPreset("custom");
                    }
                  }}
                  className="min-h-[90px] sm:min-h-[120px] text-sm"
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Dettaglio Reale (opzionale) 💣</Label>
                <Textarea
                  placeholder="Es: lavora come idraulico, ha una macchina nuova..."
                  value={realDetail}
                  onChange={(e) => {
                    setRealDetail(e.target.value);
                    setContentBlocked(null);
                  }}
                  className="min-h-[60px] sm:min-h-[80px] text-sm"
                />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Un dettaglio vero rende lo scherzo più credibile!</p>
              </div>

              {/* Content Block Alert */}
              {contentBlocked && (
                <div className="p-2.5 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-1.5 sm:space-y-2 animate-fade-in">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-destructive text-sm sm:text-base">Scherzo non consentito</h4>
                      <p className="text-xs sm:text-sm text-destructive/90">{contentBlocked.message}</p>
                      {contentBlocked.category && (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] sm:text-xs font-medium mt-1">
                          <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          {contentBlocked.category === 'TRAUMA' && 'Eventi traumatici'}
                          {contentBlocked.category === 'SCAM' && 'Potenziale truffa'}
                          {contentBlocked.category === 'THREATS' && 'Minacce/Intimidazioni'}
                          {contentBlocked.category === 'SENSITIVE' && 'Contenuto sensibile'}
                          {contentBlocked.category === 'AUTHORITY' && 'Autorità/Enti pubblici'}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground ml-7 sm:ml-9">
                    Modifica il contenuto per continuare.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Voice Selection */}
        {currentStep === 3 && (
          <Card className="animate-fade-in">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10">
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Scegli la voce</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Chi farà la chiamata?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 space-y-3 sm:space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <span className="text-base sm:text-lg">🇮🇹</span>
                <span className="font-medium text-foreground text-sm sm:text-base">Italiano</span>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Tono Personalità</Label>
                <Select value={personalityTone} onValueChange={setPersonalityTone}>
                  <SelectTrigger className="h-10 sm:h-12 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {maleVoices.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-muted-foreground text-xs sm:text-sm">👨 Voci Maschili</Label>
                  <div className="grid gap-2 sm:gap-3">
                    {maleVoices.map((voice) => (
                      <VoiceCard
                        key={voice.id}
                        voice={voice}
                        isSelected={selectedVoiceId === voice.id}
                        isPlaying={playingVoiceId === voice.id}
                        isLoading={loadingPreviewId === voice.id}
                        onSelect={() => setSelectedVoiceId(voice.id)}
                        onPlayPreview={() => playVoicePreview(voice)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {femaleVoices.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-muted-foreground text-xs sm:text-sm">👩 Voci Femminili</Label>
                  <div className="grid gap-2 sm:gap-3">
                    {femaleVoices.map((voice) => (
                      <VoiceCard
                        key={voice.id}
                        voice={voice}
                        isSelected={selectedVoiceId === voice.id}
                        isPlaying={playingVoiceId === voice.id}
                        isLoading={loadingPreviewId === voice.id}
                        onSelect={() => setSelectedVoiceId(voice.id)}
                        onPlayPreview={() => playVoicePreview(voice)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {allVoices.length === 0 && (
                <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">
                  Nessuna voce configurata
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Summary */}
        {currentStep === 4 && (
          <div className="space-y-3 sm:space-y-4 animate-fade-in">
            {/* Prank availability indicator */}
            {profile && (
              <Card className={`border-2 ${
                canMakePrank().allowed 
                  ? canMakePrank().isTrialCall 
                    ? "border-orange-500/50 bg-orange-500/5" 
                    : "border-green-500/50 bg-green-500/5"
                  : "border-destructive/50 bg-destructive/5"
              }`}>
                <CardContent className="p-3 sm:p-4">
                  {canMakePrank().allowed ? (
                    canMakePrank().isTrialCall ? (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/20">
                          <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-orange-500 text-sm sm:text-base">Prank Gratuito 🎁</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Chiama chi vuoi · SMS rivelatore obbligatorio
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/20">
                          <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-500 text-sm sm:text-base">Prank: {profile.available_pranks}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Dopo: {profile.available_pranks - 1} rimasti
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/20">
                        <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-semibold text-destructive text-sm sm:text-base">Nessun Prank</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {canMakePrank().reason}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Riepilogo</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Controlla prima di avviare</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 space-y-0">
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between py-1.5 sm:py-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Vittima</span>
                    <span className="font-medium text-sm sm:text-base">{victimFirstName} {victimLastName}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 sm:py-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Telefono</span>
                    <span className="font-medium font-mono text-xs sm:text-sm">{selectedCountry?.flag} {normalizeE164(victimPhone, phoneCountryCode).formatted ?? `${phoneCountryCode} ${victimPhone}`}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 sm:py-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Sesso</span>
                    <span className="font-medium text-sm sm:text-base">{victimGender === "male" ? "👨 M" : "👩 F"}</span>
                  </div>
                  <div className="py-1.5 sm:py-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Tema</span>
                    <p className="font-medium mt-0.5 text-xs sm:text-sm line-clamp-2">{prankTheme}</p>
                  </div>
                  {realDetail && (
                    <div className="py-1.5 sm:py-2">
                      <span className="text-muted-foreground text-xs sm:text-sm">Dettaglio</span>
                      <p className="font-medium mt-0.5 text-xs sm:text-sm line-clamp-2">{realDetail}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5 sm:py-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Voce</span>
                    <span className="font-medium text-sm sm:text-base">{selectedVoice?.voice_name || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 sm:py-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Tono</span>
                    <span className="font-medium text-sm sm:text-base">{TONES.find(t => t.value === personalityTone)?.label}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <p className="text-[10px] sm:text-sm">Registrazione disponibile a fine chiamata</p>
                </div>
                
                {/* SMS Reveal - Always mandatory */}
                <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 border-orange-500/50 bg-orange-500/5">
                  <div className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center shrink-0 border-orange-500 bg-orange-500">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 shrink-0" />
                      <span className="font-medium text-sm sm:text-base">SMS rivelatore obbligatorio 📱</span>
                    </div>
                    <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                      Se la chiamata dura più di <strong className="text-foreground">30 secondi</strong>, dopo <strong className="text-foreground">2 minuti</strong> la vittima riceverà un messaggio in cui è scritto che lo scherzo parte dal tuo numero <strong className="text-foreground">({profile?.phone_number})</strong>. Scherza solo con chi può apprezzare!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 sm:h-14 text-sm sm:text-base"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
              Indietro
            </Button>
          )}
          
          {currentStep < 4 ? (
            <Button
              type="button"
              className="flex-1 h-11 sm:h-14 gradient-primary text-sm sm:text-base"
              onClick={handleNext}
              disabled={contentCheckLoading || !!contentBlocked}
            >
              {contentCheckLoading ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Verifica contenuto...</span>
                  <span className="sm:hidden">Verifica...</span>
                </div>
              ) : (
                <>
                  Avanti
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1 h-11 sm:h-14 gradient-primary shadow-glow text-sm sm:text-base"
              onClick={handleSubmit}
              disabled={loading || !canMakePrank().allowed}
            >
              {loading ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden sm:inline">Preparando...</span>
                  <span className="sm:hidden">Preparo...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Avvia Scherzo</span>
                  <span className="sm:hidden">Avvia</span>
                </div>
              )}
            </Button>
          )}
        </div>
      </main>

      {/* Disclaimer Modal */}
      <PrankDisclaimerModal
        open={showDisclaimerModal}
        onOpenChange={(open) => {
          setShowDisclaimerModal(open);
          if (!open && pendingPrankId) {
            // If modal is closed without confirming, delete the pending prank
            supabase.from("pranks").delete().eq("id", pendingPrankId);
            setPendingPrankId(null);
          }
          if (!open) {
            confirmLockedRef.current = false;
          }
        }}
        onConfirm={handleDisclaimerConfirm}
        loading={loading}
        userId={user?.id || ""}
        prankId={pendingPrankId || undefined}
      />
    </div>
  );
};

export default CreatePrank;
