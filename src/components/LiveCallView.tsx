import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AudioWaveAnimation from "./AudioWaveAnimation";
import LiveCallAudio from "./LiveCallAudio";
import { toast } from "sonner";

interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface LiveCallViewProps {
  prankId: string;
  victimName: string;
  callStatus: string;
  onClose?: () => void;
}

const LiveCallView = ({ prankId, victimName, callStatus: initialCallStatus, onClose }: LiveCallViewProps) => {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [callStatus, setCallStatus] = useState(initialCallStatus);
  const [listenUrl, setListenUrl] = useState<string | null>(null);

  useEffect(() => {
    let pollIntervalId: number | null = null;

    const isActiveStatus = (status: string) =>
      ["initiated", "pending", "queued", "ringing", "in_progress"].includes(status);

    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from("pranks")
        .select("conversation_history, call_status, listen_url")
        .eq("id", prankId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching prank live data:", error);
        return;
      }

      if (!data) return;

      if (data.call_status) {
        setCallStatus(data.call_status);

        // Stop polling once the call is no longer active (but after we got the final state)
        if (!isActiveStatus(data.call_status) && pollIntervalId) {
          window.clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
      }

      if ((data as any).listen_url) {
        setListenUrl((data as any).listen_url);
      }

      if (data.conversation_history && Array.isArray(data.conversation_history)) {
        const messages = data.conversation_history as unknown as TranscriptMessage[];
        setTranscript(messages);

        // Check if last message is from assistant to animate
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "assistant") {
          setIsAISpeaking(true);
          window.setTimeout(() => setIsAISpeaking(false), 2000);
        }
      }
    };

    // Initial fetch
    fetchLatest();

    // Subscribe to real-time updates (when available)
    const channel = supabase
      .channel(`prank-${prankId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pranks",
          filter: `id=eq.${prankId}`,
        },
        (payload) => {
          const newData = payload.new as {
            conversation_history?: unknown[];
            call_status?: string;
            listen_url?: string | null;
          };

          if (newData.call_status) {
            setCallStatus(newData.call_status);
          }

          if (newData.listen_url) {
            setListenUrl(newData.listen_url);
          }

          if (
            newData.conversation_history &&
            Array.isArray(newData.conversation_history)
          ) {
            const messages =
              newData.conversation_history as unknown as TranscriptMessage[];
            setTranscript(messages);

            const lastMessage = messages[messages.length - 1];
            if (lastMessage?.role === "assistant") {
              setIsAISpeaking(true);
              window.setTimeout(() => setIsAISpeaking(false), 2000);
            }
          }
        }
      )
      .subscribe();

    // Poll fallback: ensures transcript + status update even if Realtime is misconfigured.
    pollIntervalId = window.setInterval(fetchLatest, 2500);

    return () => {
      if (pollIntervalId) {
        window.clearInterval(pollIntervalId);
      }
      supabase.removeChannel(channel);
    };
  }, [prankId]);


  const isCallActive = ["initiated", "pending", "queued", "ringing", "in_progress"].includes(callStatus);

  const handleEndCall = async () => {
    setIsEndingCall(true);
    try {
      const { data, error } = await supabase.functions.invoke('end-call-vapi', {
        body: { prankId }
      });

      if (error) {
        // Check if it's a JSON error response
        const errorBody = error.context?.body;
        if (errorBody) {
          try {
            const parsed = JSON.parse(errorBody);
            throw new Error(parsed.error || 'Errore sconosciuto');
          } catch {
            throw error;
          }
        }
        throw error;
      }

      toast.success(data?.message === 'Prank cancelled (call never started)' 
        ? "Scherzo annullato" 
        : "Chiamata terminata");
      onClose?.();
    } catch (error: any) {
      console.error('Error ending call:', error);
      toast.error(error.message || "Errore nel terminare la chiamata");
    } finally {
      setIsEndingCall(false);
    }
  };

  return (
    <Card className="shadow-glow border-primary/30 bg-background-level-1 overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCallActive ? 'bg-green-500/20' : 'bg-muted'}`}>
              {isCallActive ? (
                <Phone className="w-5 h-5 text-green-500 animate-pulse" />
              ) : (
                <PhoneOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">{victimName}</h3>
              <Badge 
                variant="outline" 
                className={`text-xs ${isCallActive ? 'border-green-500/50 text-green-500' : 'border-muted-foreground/50'}`}
              >
                {callStatus === "initiated" || callStatus === "pending" || callStatus === "queued" ? "Avviando..." :
                 callStatus === "ringing" ? "Squillando..." : 
                 callStatus === "in_progress" ? "In corso" : 
                 "Chiamata terminata"}
              </Badge>
            </div>
          </div>
          
          {/* Audio Wave Animation */}
          <AudioWaveAnimation isActive={isCallActive && isAISpeaking} barCount={7} />
        </div>

        {/* Transcript Area */}
        <div className="bg-background-level-0 rounded-lg p-3 max-h-48 overflow-y-auto space-y-3">
          {transcript.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              {isCallActive ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>In attesa della conversazione...</span>
                </div>
              ) : (
                "Nessun transcript disponibile"
              )}
            </div>
          ) : (
            transcript.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "assistant"
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <span className="text-xs font-medium opacity-70 block mb-1">
                    {message.role === "assistant" ? "🤖 AI" : "👤 Vittima"}
                  </span>
                  {message.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Active call indicator and End Call button */}
        {isCallActive && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-green-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Chiamata attiva
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndCall}
              disabled={isEndingCall}
              className="gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              {isEndingCall ? "Terminando..." : "Termina"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveCallView;
