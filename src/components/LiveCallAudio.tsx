import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Headphones, HeadphoneOff, Loader2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

interface LiveCallAudioProps {
  listenUrl: string | null | undefined;
  /** Disable the listen button (e.g. call not active anymore) */
  disabled?: boolean;
  /** Compact button layout (icon-only) */
  compact?: boolean;
  /** Make button take full width of its container (useful on mobile) */
  fullWidth?: boolean;
}

/**
 * Connects to VAPI's `monitor.listenUrl` WebSocket and plays the live PCM audio
 * stream (16-bit signed little-endian) using the Web Audio API.
 *
 * VAPI streams raw PCM s16le @ 16kHz mono by default; we resample on the fly
 * via the AudioContext sample rate.
 */
const LiveCallAudio = ({ listenUrl, disabled, compact, fullWidth }: LiveCallAudioProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const connectionTimeoutRef = useRef<number | null>(null);

  const SAMPLE_RATE = 16000; // VAPI default for listenUrl

  const clearConnectionTimeout = () => {
    if (connectionTimeoutRef.current) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  const resamplePcmChunk = (buffer: ArrayBuffer, inputRate: number, outputRate: number) => {
    const view = new DataView(buffer);
    const inputLength = buffer.byteLength / 2;
    const source = new Float32Array(inputLength);

    for (let i = 0; i < inputLength; i++) {
      source[i] = view.getInt16(i * 2, true) / 32768;
    }

    if (inputRate === outputRate) {
      return source;
    }

    const outputLength = Math.max(1, Math.round((inputLength * outputRate) / inputRate));
    const resampled = new Float32Array(outputLength);
    const ratio = inputRate / outputRate;

    for (let i = 0; i < outputLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const nextIndex = Math.min(index + 1, inputLength - 1);
      const fraction = position - index;

      resampled[i] = source[index] + (source[nextIndex] - source[index]) * fraction;
    }

    return resampled;
  };

  const stopListening = () => {
    clearConnectionTimeout();

    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;

    try {
      audioContextRef.current?.close();
    } catch {}
    audioContextRef.current = null;
    gainNodeRef.current = null;
    nextStartTimeRef.current = 0;

    setIsListening(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = async () => {
    if (!listenUrl) {
      toast.error("URL di ascolto non ancora disponibile. Riprova tra qualche secondo.");
      return;
    }

    setIsConnecting(true);

    try {
      // Use the device default output sample rate for best Safari/iOS compatibility.
      // We resample the incoming 16kHz PCM stream before playback.
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new AudioCtx({ latencyHint: "interactive" });
      audioContextRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : 1;
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;

      // Resume on user gesture (Safari/iOS)
      if (ctx.state === "suspended") {
        await Promise.race([
          ctx.resume(),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("resume-timeout")), 1500);
          }),
        ]).catch((error) => {
          console.warn("[LiveCallAudio] AudioContext resume warning:", error);
        });
      }

      const ws = new WebSocket(listenUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      clearConnectionTimeout();
      connectionTimeoutRef.current = window.setTimeout(() => {
        console.error("[LiveCallAudio] WS connection timeout");
        toast.error("Connessione audio non riuscita. Riprova toccando di nuovo.");
        stopListening();
      }, 8000);

      ws.onopen = () => {
        console.log("[LiveCallAudio] WS connected");
        clearConnectionTimeout();
        setIsConnecting(false);
        setIsListening(true);
        nextStartTimeRef.current = ctx.currentTime + 0.1; // small jitter buffer
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          // VAPI sends a JSON control frame first (with sampleRate etc.)
          try {
            const msg = JSON.parse(event.data);
            console.log("[LiveCallAudio] control:", msg);
          } catch {
            // ignore
          }
          return;
        }

        const buffer = event.data as ArrayBuffer;
        if (!buffer || buffer.byteLength === 0) return;

        if (ctx.state !== "running") {
          ctx.resume().catch((error) => {
            console.warn("[LiveCallAudio] resume before playback warning:", error);
          });
        }

        const float32 = resamplePcmChunk(buffer, SAMPLE_RATE, ctx.sampleRate);
        const audioBuffer = ctx.createBuffer(1, float32.length, ctx.sampleRate);
        audioBuffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current || ctx.destination);

        const now = ctx.currentTime;
        if (nextStartTimeRef.current < now) {
          nextStartTimeRef.current = now + 0.05;
        }
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
      };

      ws.onerror = (err) => {
        console.error("[LiveCallAudio] WS error:", err);
        clearConnectionTimeout();
        toast.error("Errore di connessione audio");
        stopListening();
      };

      ws.onclose = () => {
        console.log("[LiveCallAudio] WS closed");
        clearConnectionTimeout();
        stopListening();
      };
    } catch (e: any) {
      console.error("[LiveCallAudio] start error:", e);
      toast.error(e?.message || "Impossibile avviare l'ascolto");
      stopListening();
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = next ? 0 : 1;
    }
  };

  if (!isListening) {
    return (
      <Button
        variant="outline"
        size={compact ? "icon" : "sm"}
        onClick={startListening}
        disabled={disabled || isConnecting || !listenUrl}
        className={`gap-2 ${fullWidth ? "w-full" : ""}`}
        title={!listenUrl ? "URL di ascolto non disponibile" : "Ascolta in diretta"}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Headphones className="w-4 h-4" />
        )}
        {!compact && (isConnecting ? "Connessione..." : "Ascolta live")}
      </Button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${fullWidth ? "w-full" : ""}`}>
      <Button
        variant="outline"
        size={compact ? "icon" : "sm"}
        onClick={toggleMute}
        className="gap-2"
        title={isMuted ? "Riattiva audio" : "Silenzia"}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-green-500" />}
      </Button>
      <Button
        variant="destructive"
        size={compact ? "icon" : "sm"}
        onClick={stopListening}
        className={`gap-2 ${fullWidth ? "flex-1" : ""}`}
      >
        <HeadphoneOff className="w-4 h-4" />
        {!compact && "Stop ascolto"}
      </Button>
    </div>
  );
};

export default LiveCallAudio;
