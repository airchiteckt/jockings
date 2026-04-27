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
  const inputSampleRateRef = useRef<number>(16000);
  const inputChannelsRef = useRef<number>(1);

  const clearConnectionTimeout = () => {
    if (connectionTimeoutRef.current) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  /**
   * Decode raw PCM s16le buffer into one Float32Array per channel.
   * Handles interleaved stereo (or any channel count) and resamples each
   * channel independently from inputRate to outputRate.
   */
  const decodePcmChunk = (
    buffer: ArrayBuffer,
    channels: number,
    inputRate: number,
    outputRate: number,
  ): Float32Array[] => {
    const view = new DataView(buffer);
    const totalSamples = buffer.byteLength / 2;
    const framesIn = Math.floor(totalSamples / channels);

    // Deinterleave
    const sources: Float32Array[] = [];
    for (let c = 0; c < channels; c++) {
      sources.push(new Float32Array(framesIn));
    }
    for (let f = 0; f < framesIn; f++) {
      for (let c = 0; c < channels; c++) {
        const sampleIndex = f * channels + c;
        sources[c][f] = view.getInt16(sampleIndex * 2, true) / 32768;
      }
    }

    if (inputRate === outputRate) {
      return sources;
    }

    // Linear resample per channel
    const framesOut = Math.max(1, Math.round((framesIn * outputRate) / inputRate));
    const ratio = inputRate / outputRate;
    return sources.map((src) => {
      const out = new Float32Array(framesOut);
      for (let i = 0; i < framesOut; i++) {
        const position = i * ratio;
        const index = Math.floor(position);
        const nextIndex = Math.min(index + 1, framesIn - 1);
        const fraction = position - index;
        out[i] = src[index] + (src[nextIndex] - src[index]) * fraction;
      }
      return out;
    });
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
          // VAPI sends a JSON control frame first (with sampleRate, channels, etc.)
          try {
            const msg = JSON.parse(event.data);
            console.log("[LiveCallAudio] control:", msg);
            if (msg && typeof msg === "object") {
              if (typeof msg.sampleRate === "number" && msg.sampleRate > 0) {
                inputSampleRateRef.current = msg.sampleRate;
              }
              if (typeof msg.channels === "number" && msg.channels > 0) {
                inputChannelsRef.current = msg.channels;
              }
            }
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

        const channels = inputChannelsRef.current || 1;
        const inputRate = inputSampleRateRef.current || 16000;
        const channelData = decodePcmChunk(buffer, channels, inputRate, ctx.sampleRate);
        if (channelData.length === 0 || channelData[0].length === 0) return;

        const audioBuffer = ctx.createBuffer(channels, channelData[0].length, ctx.sampleRate);
        for (let c = 0; c < channels; c++) {
          audioBuffer.getChannelData(c).set(channelData[c]);
        }

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
