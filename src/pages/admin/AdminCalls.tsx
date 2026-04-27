import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Phone, Shield, Search, Play, RefreshCw, ChevronDown, ChevronUp, Cpu, Mic, Settings2, User } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import LiveCallAudio from "@/components/LiveCallAudio";

interface PrankCall {
  id: string;
  victim_first_name: string;
  victim_last_name: string;
  victim_phone: string;
  prank_theme: string;
  call_status: string;
  recording_url: string | null;
  created_at: string;
  language: string;
  voice_gender: string;
  user_id: string;
  voice_provider: string;
  elevenlabs_voice_id: string | null;
  elevenlabs_stability: number | null;
  elevenlabs_similarity: number | null;
  elevenlabs_style: number | null;
  elevenlabs_speed: number | null;
  twilio_call_sid: string | null;
  max_duration: number;
  creativity_level: number;
  personality_tone: string;
  scheduled_at: string | null;
  listen_url: string | null;
}

interface UserProfile {
  user_id: string;
  username: string | null;
  phone_number: string | null;
}

const AdminCalls = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdminCheck();
  const [calls, setCalls] = useState<PrankCall[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [search, setSearch] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/auth");
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchCalls();
    }
  }, [isAdmin]);

  const fetchCalls = async () => {
    setLoadingCalls(true);

    const { data, error } = await supabase
      .from("pranks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setCalls(data as PrankCall[]);
      
      // Fetch user profiles for all unique user_ids
      const userIds = [...new Set(data.map(p => p.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, phone_number")
          .in("user_id", userIds);
        
        if (profiles) {
          const profileMap = new Map<string, UserProfile>();
          profiles.forEach(p => profileMap.set(p.user_id, p));
          setUserProfiles(profileMap);
        }
      }
    }
    setLoadingCalls(false);
  };

  const playRecording = async (call: PrankCall) => {
    if (!call.recording_url) return;
    
    setLoadingAudio(call.id);
    try {
      // VAPI recordings are direct URLs, Twilio URLs contain api.twilio.com
      const isTwilioRecording = call.recording_url.includes('api.twilio.com');
      
      if (isTwilioRecording) {
        // Twilio recordings need authentication via edge function
        const { data, error } = await supabase.functions.invoke("get-recording", {
          body: { recordingUrl: call.recording_url },
        });

        if (error) throw error;
        
        if (data?.audioBase64) {
          const binaryString = atob(data.audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
      } else {
        // VAPI and other recordings are directly accessible
        setAudioUrl(call.recording_url);
      }
    } catch (error) {
      console.error("Error loading recording:", error);
    } finally {
      setLoadingAudio(null);
    }
  };

  const toggleExpand = (callId: string) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "in_progress":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "failed":
      case "no_answer":
      case "busy":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "recording_available":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "scheduled":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "In attesa";
      case "initiated": return "Avviata";
      case "ringing": return "Squilla";
      case "in_progress": return "In corso";
      case "completed": return "Completata";
      case "failed": return "Fallita";
      case "no_answer": return "Non risponde";
      case "busy": return "Occupato";
      case "recording_available": return "🎙️ Registrazione";
      case "scheduled": return "Programmata";
      case "cancelled": return "Annullata";
      default: return status;
    }
  };

  const getPersonalityLabel = (tone: string) => {
    const map: Record<string, string> = {
      enthusiastic: "🎉 Entusiasta",
      serious: "🎩 Serio",
      angry: "😠 Arrabbiato",
      confused: "😵 Confuso",
      mysterious: "🕵️ Misterioso",
      friendly: "😊 Amichevole",
    };
    return map[tone] || tone;
  };

  const filteredCalls = calls.filter(
    (call) =>
      call.victim_first_name.toLowerCase().includes(search.toLowerCase()) ||
      call.victim_last_name.toLowerCase().includes(search.toLowerCase()) ||
      call.victim_phone.includes(search) ||
      call.prank_theme.toLowerCase().includes(search.toLowerCase()) ||
      (call.twilio_call_sid && call.twilio_call_sid.toLowerCase().includes(search.toLowerCase()))
  );

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
              <Phone className="w-5 h-5 text-green-500" />
              <h1 className="font-bold">Log Chiamate</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCalls}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, telefono, tema, call SID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <audio src={audioUrl} controls autoPlay className="w-full" />
            </CardContent>
          </Card>
        )}

        {/* Calls List */}
        {loadingCalls ? (
          <div className="text-center py-12 text-muted-foreground">
            Caricamento chiamate...
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {filteredCalls.length} chiamate trovate
            </p>
            {filteredCalls.map((call) => (
              <Collapsible key={call.id} open={expandedCalls.has(call.id)} onOpenChange={() => toggleExpand(call.id)}>
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {call.victim_first_name} {call.victim_last_name}
                          </p>
                          <Badge variant="outline" className={getStatusColor(call.call_status)}>
                            {getStatusLabel(call.call_status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {call.victim_phone} • {call.language} • {call.voice_gender === "male" ? "♂ Maschio" : call.voice_gender === "female" ? "♀ Femmina" : "⚥ Neutro"}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {call.prank_theme}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 text-xs bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
                            <User className="w-3 h-3" />
                            <span>{userProfiles.get(call.user_id)?.username || userProfiles.get(call.user_id)?.phone_number || 'Utente sconosciuto'}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(call.created_at), "d MMM yyyy HH:mm", { locale: it })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {call.call_status === "in_progress" && (
                          <LiveCallAudio listenUrl={call.listen_url} compact />
                        )}
                        {call.recording_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => playRecording(call)}
                            disabled={loadingAudio === call.id}
                          >
                            {loadingAudio === call.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {expandedCalls.has(call.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-4">
                      <div className="border-t pt-4 space-y-4">
                        {/* Tech Stack */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Cpu className="w-4 h-4 text-primary" />
                            Stack Tecnologico
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-muted/50 rounded-lg p-2">
                              <span className="text-muted-foreground">Voice Provider:</span>
                              <p className="font-mono font-medium text-primary">
                                {call.voice_provider === 'elevenlabs' || call.voice_provider === '11labs' ? '🔊 ElevenLabs' : '🎙️ OpenAI/Polly'}
                              </p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <span className="text-muted-foreground">Personalità:</span>
                              <p className="font-medium">{getPersonalityLabel(call.personality_tone)}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <span className="text-muted-foreground">Durata Max:</span>
                              <p className="font-medium">{call.max_duration}s</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <span className="text-muted-foreground">Creatività:</span>
                              <p className="font-medium">{call.creativity_level}%</p>
                            </div>
                          </div>
                        </div>

                        {/* ElevenLabs Settings */}
                        {(call.voice_provider === 'elevenlabs' || call.voice_provider === '11labs') && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Mic className="w-4 h-4 text-purple-500" />
                              ElevenLabs Config
                            </div>
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Voice ID:</span>
                                  <p className="font-mono text-purple-600 break-all">
                                    {call.elevenlabs_voice_id || 'default'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Stability:</span>
                                  <p className="font-medium">{((call.elevenlabs_stability ?? 0.5) * 100).toFixed(0)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Similarity:</span>
                                  <p className="font-medium">{((call.elevenlabs_similarity ?? 0.75) * 100).toFixed(0)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Style:</span>
                                  <p className="font-medium">{((call.elevenlabs_style ?? 0) * 100).toFixed(0)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Speed:</span>
                                  <p className="font-medium">{call.elevenlabs_speed ?? 1.0}x</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Twilio Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Settings2 className="w-4 h-4 text-red-500" />
                            Twilio Info
                          </div>
                          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="text-muted-foreground">Call SID:</span>
                                <p className="font-mono text-red-600 break-all">
                                  {call.twilio_call_sid || 'N/A'}
                                </p>
                              </div>
                              {call.recording_url && (
                                <div>
                                  <span className="text-muted-foreground">Recording URL:</span>
                                  <p className="font-mono text-red-600 break-all text-[10px]">
                                    {call.recording_url}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* IDs */}
                        <div className="text-[10px] font-mono text-muted-foreground border-t pt-2">
                          <p>Prank ID: {call.id}</p>
                          <p>User ID: {call.user_id}</p>
                          {call.scheduled_at && (
                            <p>Scheduled: {format(new Date(call.scheduled_at), "d MMM yyyy HH:mm", { locale: it })}</p>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminCalls;
