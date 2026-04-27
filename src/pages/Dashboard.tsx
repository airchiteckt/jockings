import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Phone, Plus, History, Settings, LogOut, User, ArrowRight } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import PrankCard from "@/components/PrankCard";
import OnboardingModal from "@/components/OnboardingModal";
import saranoWordmarkIcon from "@/assets/sarano-wordmark-icon.png";
import saranoIcon from "@/assets/sarano-icon.png";

interface Profile {
  username: string | null;
  available_pranks: number;
  avatar_url: string | null;
  card_verified: boolean;
  trial_prank_used: boolean;
}

interface Prank {
  id: string;
  victim_first_name: string;
  victim_last_name: string;
  victim_phone: string;
  prank_theme: string;
  call_status: string;
  recording_url: string | null;
  created_at: string;
  scheduled_at: string | null;
}

interface Victim {
  phone: string;
  firstName: string;
  lastName: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pranks, setPranks] = useState<Prank[]>([]);
  const [victims, setVictims] = useState<Victim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPranksAndVictims();

      // Realtime subscription for pranks updates
      const channel = supabase
        .channel('pranks-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pranks',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Realtime update:', payload);
            if (payload.eventType === 'UPDATE') {
              setPranks(prev => prev.map(p => 
                p.id === payload.new.id 
                  ? { ...p, call_status: payload.new.call_status, recording_url: payload.new.recording_url }
                  : p
              ));
            } else if (payload.eventType === 'INSERT') {
              fetchPranksAndVictims();
            } else if (payload.eventType === 'DELETE') {
              setPranks(prev => prev.filter(p => p.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("username, available_pranks, avatar_url, card_verified, trial_prank_used")
      .eq("user_id", user.id)
      .single();
    
    if (error) {
      console.error("Error fetching profile:", error);
    } else {
      const profileData = {
        username: data.username,
        available_pranks: data.available_pranks ?? 0,
        avatar_url: data.avatar_url,
        card_verified: data.card_verified ?? false,
        trial_prank_used: data.trial_prank_used ?? false,
      };
      setProfile(profileData);
      // Show onboarding if trial not used yet
      if (!profileData.trial_prank_used) {
        setShowOnboarding(true);
      }
    }
  };

  const fetchPranksAndVictims = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_user_pranks_decrypted');
    
    if (error) {
      console.error("Error fetching pranks:", error);
    } else {
      const sorted = (data || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPranks(sorted.slice(0, 10));

      // Extract unique victims from the same data
      const uniqueVictims: Victim[] = [];
      const seenPhones = new Set<string>();
      for (const prank of sorted) {
        if (prank.victim_phone && !seenPhones.has(prank.victim_phone)) {
          seenPhones.add(prank.victim_phone);
          uniqueVictims.push({
            phone: prank.victim_phone,
            firstName: prank.victim_first_name,
            lastName: prank.victim_last_name,
          });
        }
      }
      setVictims(uniqueVictims);
    }
    setLoading(false);
  };


  const handleCancelPrank = async (prankId: string) => {
    const { error } = await supabase
      .from("pranks")
      .update({ call_status: "cancelled" })
      .eq("id", prankId);
    
    if (error) {
      toast({ title: "Errore", description: "Impossibile annullare lo scherzo", variant: "destructive" });
    } else {
      toast({ title: "Scherzo annullato", description: "Lo scherzo programmato è stato annullato" });
      fetchPranksAndVictims();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Arrivederci! 👋", description: "Logout effettuato con successo" });
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "in_progress": return "bg-secondary/10 text-secondary border-secondary/20";
      case "initiated": return "bg-secondary/10 text-secondary border-secondary/20";
      case "ringing": return "bg-secondary/10 text-secondary border-secondary/20";
      case "failed": 
      case "no_answer":
      case "busy": return "bg-destructive/10 text-destructive border-destructive/20";
      case "recording_available": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "scheduled": return "bg-accent/10 text-accent border-accent/20";
      case "cancelled": return "bg-muted text-muted-foreground border-border";
      default: return "bg-accent/10 text-accent border-accent/20";
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

  const effectivePranks = (profile?.available_pranks || 0) + 
    (!profile?.trial_prank_used && (profile?.available_pranks || 0) === 0 ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img 
            src={saranoIcon} 
            alt="Caricamento..." 
            className="w-16 h-16 mx-auto animate-icon-spin" 
          />
          <p className="mt-4 text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-24">
      <OnboardingModal
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => {
          setShowOnboarding(false);
          navigate("/create-prank");
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <img 
            src={saranoWordmarkIcon} 
            alt="sarano.ai" 
            className="h-6 sm:h-8 object-contain" 
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={handleLogout}>
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </header>

      <main className="px-3 py-4 sm:px-4 sm:py-6 max-w-lg mx-auto space-y-4 sm:space-y-6">
        {/* Welcome Card */}
        <Card className="bg-primary text-primary-foreground shadow-card animate-slide-up overflow-hidden relative">
          <img 
            src={saranoIcon} 
            alt="" 
            className="absolute -right-2 -bottom-2 w-16 h-16 sm:w-20 sm:h-20 object-contain opacity-20 animate-float pointer-events-none" 
          />
          <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2 relative z-10">
            <CardTitle className="text-lg sm:text-xl text-primary-foreground">Ciao, {profile?.username || "amico"}! 🎭</CardTitle>
            <CardDescription className="text-primary-foreground/80 text-xs sm:text-sm">
              Pronto a fare qualche scherzo?
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-1 sm:pt-0 relative z-10">
            <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer" onClick={() => navigate("/pricing")}>
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-bold text-base sm:text-lg">
                {effectivePranks}
              </span>
              <span className="text-xs sm:text-sm opacity-80">prank disponibili</span>
            </div>
          </CardContent>
        </Card>

        {/* Promo Banner */}
        <Card 
          className="relative overflow-hidden cursor-pointer border-secondary/30 bg-gradient-to-r from-secondary/10 via-primary/5 to-secondary/10 animate-slide-up"
          style={{ animationDelay: "0.08s" }}
          onClick={() => navigate("/pricing")}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/5 via-transparent to-secondary/5 animate-pulse" />
          <CardContent className="p-3 sm:p-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary/20 flex items-center justify-center animate-bounce" style={{ animationDuration: "2s" }}>
                <span className="text-lg sm:text-xl">🔥</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm sm:text-base text-foreground">
                  Offerta Lancio: <span className="text-secondary">-30%</span> su tutti i pacchetti!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {!profile?.trial_prank_used
                    ? "Hai 1 prank gratuito! Chiama chi vuoi, subito!"
                    : "Per altri scherzi, scegli un pacchetto!"
                  }
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-secondary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            onClick={() => navigate("/create-prank")}
            className="h-auto py-4 sm:py-6 flex flex-col gap-1.5 sm:gap-2 bg-primary text-primary-foreground shadow-card hover:bg-primary/90 transition-all animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
            <span className="font-semibold text-sm sm:text-base">Nuovo Scherzo</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/history")}
            className="h-auto py-4 sm:py-6 flex flex-col gap-1.5 sm:gap-2 shadow-card hover:bg-muted transition-all animate-slide-up border-border"
            style={{ animationDelay: "0.15s" }}
          >
            <History className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            <span className="font-semibold text-foreground text-sm sm:text-base">Cronologia</span>
          </Button>
        </div>

        {/* Victims */}
        {victims.length > 0 && (
          <section className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Vittime</h2>
            </div>
            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4">
              {victims.map((victim) => (
                <Card 
                  key={victim.phone} 
                  className="min-w-[100px] sm:min-w-[120px] flex-shrink-0 cursor-pointer hover:bg-muted transition-all shadow-card"
                  onClick={() => navigate(`/create-prank?phone=${encodeURIComponent(victim.phone)}&firstName=${encodeURIComponent(victim.firstName)}&lastName=${encodeURIComponent(victim.lastName)}`)}
                >
                  <CardContent className="p-2.5 sm:p-4 text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-1.5 sm:mb-2 rounded-full bg-secondary/20 flex items-center justify-center">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                    </div>
                    <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{victim.firstName}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{victim.lastName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Recent Pranks */}
        <section className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Scherzi Recenti</h2>
          {pranks.length > 0 && (
              <Button variant="link" className="text-secondary p-0 text-xs sm:text-sm" onClick={() => navigate("/history")}>
                Vedi tutti →
              </Button>
            )}
          </div>

          {pranks.length === 0 ? (
            <Card className="text-center py-8 sm:py-12 shadow-card">
              <CardContent className="p-3 sm:p-6">
                <Phone className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/30 mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Nessuno scherzo ancora</p>
                <p className="text-xs sm:text-sm text-muted-foreground/70 mb-3 sm:mb-4">
                  Crea il tuo primo scherzo telefonico AI!
                </p>
                <Button onClick={() => navigate("/create-prank")} className="bg-primary text-primary-foreground text-sm sm:text-base">
                  <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
                  Crea Scherzo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {pranks.slice(0, 5).map((prank, index) => (
                <PrankCard
                  key={prank.id}
                  prank={prank}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                  onRepeat={() => navigate(`/create-prank?repeat=${prank.id}`)}
                  onQuickCall={index === 0 ? (theme) => navigate(`/create-prank?quickCall=${prank.id}&addTheme=${encodeURIComponent(theme)}`) : undefined}
                  onCancel={() => handleCancelPrank(prank.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border px-2 py-1.5 sm:px-4 sm:py-2 safe-area-bottom">
        <div className="flex justify-around max-w-lg mx-auto">
          <Button variant="ghost" className="flex-col gap-0.5 sm:gap-1 h-auto py-1.5 sm:py-2 px-2 sm:px-4" onClick={() => navigate("/dashboard")}>
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="text-[10px] sm:text-xs text-primary">Home</span>
          </Button>
          <Button variant="ghost" className="flex-col gap-0.5 sm:gap-1 h-auto py-1.5 sm:py-2 px-2 sm:px-4" onClick={() => navigate("/create-prank")}>
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Nuovo</span>
          </Button>
          <Button variant="ghost" className="flex-col gap-0.5 sm:gap-1 h-auto py-1.5 sm:py-2 px-2 sm:px-4" onClick={() => navigate("/history")}>
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Storia</span>
          </Button>
          <Button variant="ghost" className="flex-col gap-0.5 sm:gap-1 h-auto py-1.5 sm:py-2 px-2 sm:px-4" onClick={() => navigate("/settings")}>
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Profilo</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
