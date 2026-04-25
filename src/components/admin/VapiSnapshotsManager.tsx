import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { History, Save, RotateCcw, Trash2, Loader2, Download, FileJson } from "lucide-react";

interface Snapshot {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_auto: boolean;
  source_snapshot_id: string | null;
  app_settings_data: any;
  voice_settings_data: any;
}

interface Props {
  /** Called after a successful restore so the parent page can re-fetch its state */
  onRestored?: () => void;
}

export const VapiSnapshotsManager = ({ onRestored }: Props) => {
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [previewSnap, setPreviewSnap] = useState<Snapshot | null>(null);

  const fetchSnapshots = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vapi_settings_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Errore caricamento snapshot", description: error.message, variant: "destructive" });
    } else {
      setSnapshots((data || []) as Snapshot[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  /**
   * Capture the FULL current state from DB (not from local form state),
   * so we always snapshot the persisted truth.
   */
  const captureCurrentState = async () => {
    const [appRes, voiceRes] = await Promise.all([
      supabase.from("app_settings").select("*"),
      supabase.from("voice_settings").select("*"),
    ]);
    if (appRes.error) throw appRes.error;
    if (voiceRes.error) throw voiceRes.error;
    return {
      app_settings_data: appRes.data || [],
      voice_settings_data: voiceRes.data || [],
    };
  };

  const handleCreateSnapshot = async (
    overrideName?: string,
    overrideDescription?: string,
    isAuto = false,
    sourceSnapshotId?: string,
  ) => {
    const name = (overrideName ?? newName).trim();
    if (!name) {
      toast({ title: "Nome richiesto", description: "Inserisci un nome per lo snapshot", variant: "destructive" });
      return null;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");
      const { app_settings_data, voice_settings_data } = await captureCurrentState();
      const { data, error } = await supabase
        .from("vapi_settings_snapshots")
        .insert({
          name,
          description: (overrideDescription ?? newDescription) || null,
          created_by: user.id,
          app_settings_data,
          voice_settings_data,
          is_auto: isAuto,
          source_snapshot_id: sourceSnapshotId || null,
        })
        .select()
        .single();
      if (error) throw error;
      if (!isAuto) {
        toast({ title: "✅ Snapshot salvato", description: `"${name}" è ora ripristinabile.` });
      }
      setNewName("");
      setNewDescription("");
      setCreateOpen(false);
      await fetchSnapshots();
      return data as Snapshot;
    } catch (e: any) {
      toast({ title: "Errore salvataggio", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (snap: Snapshot) => {
    setRestoringId(snap.id);
    try {
      // 1. Backup automatico dello stato attuale prima di toccare nulla
      const autoBackup = await handleCreateSnapshot(
        `🔄 Auto-backup pre-restore — ${new Date().toLocaleString("it-IT")}`,
        `Backup automatico creato prima del restore di "${snap.name}"`,
        true,
        snap.id,
      );
      if (!autoBackup) throw new Error("Impossibile creare il backup automatico, restore annullato");

      // 2. Ripristina app_settings (upsert per chiave)
      const appRows = (snap.app_settings_data as any[]) || [];
      if (appRows.length > 0) {
        const upserts = appRows.map((r) => ({
          key: r.key,
          value: r.value,
          description: r.description ?? null,
        }));
        const { error: appErr } = await supabase
          .from("app_settings")
          .upsert(upserts, { onConflict: "key" });
        if (appErr) throw appErr;
      }

      // 3. Ripristina voice_settings: strategia replace-all per id
      const voiceRows = (snap.voice_settings_data as any[]) || [];
      if (voiceRows.length > 0) {
        // Rimuoviamo created_at/updated_at e lasciamo che il DB rigeneri updated_at
        const cleaned = voiceRows.map(({ created_at, updated_at, ...rest }: any) => rest);
        const { error: voiceErr } = await supabase
          .from("voice_settings")
          .upsert(cleaned, { onConflict: "id" });
        if (voiceErr) throw voiceErr;
      }

      toast({
        title: "✅ Restore completato",
        description: `Ripristinato "${snap.name}". Backup di sicurezza salvato.`,
      });
      onRestored?.();
    } catch (e: any) {
      toast({ title: "Errore restore", description: e.message, variant: "destructive" });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vapi_settings_snapshots").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore eliminazione", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Snapshot eliminato" });
      fetchSnapshots();
    }
  };

  const handleExport = (snap: Snapshot) => {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vapi-snapshot-${snap.name.replace(/\s+/g, "_")}-${snap.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            Backup & Restore preset VAPI
          </span>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Save className="w-4 h-4" /> Salva snapshot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Salva snapshot configurazione</DialogTitle>
                <DialogDescription>
                  Cattura l'intera configurazione VAPI corrente (impostazioni globali + tutti i preset voce). Potrai
                  ripristinarla in qualunque momento.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Nome snapshot *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="es. Setup stabile pre-test Cartesia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrizione (opzionale)</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Note su questa configurazione..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
                <Button onClick={() => handleCreateSnapshot()} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          💾 Salva una "fotografia" della configurazione attuale prima di fare modifiche sperimentali. Ogni restore crea
          automaticamente un backup di sicurezza dello stato precedente, così non perdi mai nulla.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento snapshot...
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nessuno snapshot salvato. Clicca "Salva snapshot" per creare il primo backup.
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {snapshots.map((snap) => {
              const appCount = Array.isArray(snap.app_settings_data) ? snap.app_settings_data.length : 0;
              const voiceCount = Array.isArray(snap.voice_settings_data) ? snap.voice_settings_data.length : 0;
              return (
                <div
                  key={snap.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{snap.name}</span>
                      {snap.is_auto && (
                        <Badge variant="secondary" className="text-xs">Auto-backup</Badge>
                      )}
                    </div>
                    {snap.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{snap.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>📅 {new Date(snap.created_at).toLocaleString("it-IT")}</span>
                      <span>⚙️ {appCount} settings</span>
                      <span>🎙️ {voiceCount} voci</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewSnap(snap)} title="Anteprima JSON">
                      <FileJson className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleExport(snap)} title="Scarica JSON">
                      <Download className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                          title="Ripristina"
                          disabled={restoringId === snap.id}
                        >
                          {restoringId === snap.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ripristinare "{snap.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Verranno sovrascritte le impostazioni VAPI correnti e tutti i preset voce con quelli salvati
                            in questo snapshot. <br /><br />
                            ✅ Verrà creato automaticamente un <strong>backup di sicurezza</strong> dello stato attuale
                            prima del restore, così potrai sempre tornare indietro.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRestore(snap)}>Ripristina</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare "{snap.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Lo snapshot verrà eliminato definitivamente. Questa azione non può essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => handleDelete(snap.id)}
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preview JSON */}
        <Dialog open={!!previewSnap} onOpenChange={(o) => !o && setPreviewSnap(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Anteprima: {previewSnap?.name}</DialogTitle>
              <DialogDescription>
                Contenuto completo dello snapshot in formato JSON.
              </DialogDescription>
            </DialogHeader>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[60vh]">
              {previewSnap ? JSON.stringify(
                {
                  app_settings: previewSnap.app_settings_data,
                  voice_settings: previewSnap.voice_settings_data,
                },
                null,
                2,
              ) : ""}
            </pre>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
