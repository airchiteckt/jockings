import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Phone, ArrowLeft, Check, Tag, X, CheckCircle, Clock } from "lucide-react";
import saranoIcon from "@/assets/sarano-icon.png";
import { useEffect } from "react";

interface PricingPackage {
  id: string;
  name: string;
  pranks: number;
  price: number;
  recommended?: boolean;
}

interface PromoCodeInfo {
  code: string;
  discount_percentage: number;
  id: string;
}

const LAUNCH_DISCOUNT = 0.3; // 30% off

// Returns the next 7:00 AM (Europe/Rome) as the countdown target
function getNextResetDate(): Date {
  const now = new Date();
  // Work in UTC but target 7:00 AM Rome time (UTC+1 or UTC+2 DST)
  const rome = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const todayReset = new Date(rome);
  todayReset.setHours(7, 0, 0, 0);

  // If we're past 7 AM Rome time today, target tomorrow 7 AM
  const target = rome >= todayReset
    ? new Date(todayReset.getTime() + 24 * 60 * 60 * 1000)
    : todayReset;

  // Convert back: offset = rome - now (in ms)
  const offset = rome.getTime() - now.getTime();
  return new Date(target.getTime() - offset);
}

const packages: PricingPackage[] = [
  {
    id: "pack_10",
    name: "Mega Pack",
    pranks: 10,
    price: 14.99,
  },
  {
    id: "pack_3",
    name: "Starter Pack",
    pranks: 3,
    price: 4.99,
    recommended: true,
  },
  {
    id: "pack_1",
    name: "Singolo",
    pranks: 1,
    price: 1.99,
  },
];

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = targetDate.getTime() - Date.now();
    return Math.max(0, diff);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const target = getNextResetDate();
      const diff = target.getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, expired: timeLeft <= 0 };
}

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const countdown = useCountdown(getNextResetDate());
  
  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeInfo | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const validatePromoCode = async () => {
    if (!promoInput.trim()) return;
    
    setPromoLoading(true);
    setPromoError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPromoError("Devi essere loggato per usare un codice promo");
        setPromoLoading(false);
        return;
      }

      const { data: promoCode, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promoInput.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!promoCode) {
        setPromoError("Codice non valido o scaduto");
        setPromoLoading(false);
        return;
      }

      if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
        setPromoError("Codice scaduto");
        setPromoLoading(false);
        return;
      }

      if (promoCode.max_uses) {
        const { count } = await supabase
          .from("promo_code_uses")
          .select("*", { count: "exact", head: true })
          .eq("promo_code_id", promoCode.id);
        if (count && count >= promoCode.max_uses) {
          setPromoError("Codice esaurito");
          setPromoLoading(false);
          return;
        }
      }

      const { data: existingUse } = await supabase
        .from("promo_code_uses")
        .select("id")
        .eq("promo_code_id", promoCode.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingUse) {
        setPromoError("Hai già utilizzato questo codice");
        setPromoLoading(false);
        return;
      }

      setAppliedPromo({
        code: promoCode.code,
        discount_percentage: promoCode.discount_percentage,
        id: promoCode.id,
      });
      setPromoInput("");
      toast({
        title: "Codice applicato!",
        description: `Sconto del ${promoCode.discount_percentage}% applicato`,
      });
    } catch (error: any) {
      console.error("Promo validation error:", error);
      setPromoError("Errore nella validazione del codice");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
  };

  const getDiscountedPrice = (price: number) => {
    let discounted = price * (1 - LAUNCH_DISCOUNT);
    if (appliedPromo) {
      discounted = discounted * (1 - appliedPromo.discount_percentage / 100);
    }
    return discounted;
  };

  const handleCheckout = async (packageType: string) => {
    setLoading(packageType);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { 
          packageType,
          promoCodeId: appliedPromo?.id,
          promoCode: appliedPromo?.code,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile avviare il pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img 
            src={saranoIcon} 
            alt="sarano.ai" 
            className="w-8 h-8 object-contain" 
          />
          <h1 className="font-bold text-lg text-foreground">Acquista Prank</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-1.5 rounded-full text-sm font-semibold">
            🔥 Offerta Lancio: -30% su tutto!
          </div>
          <h2 className="text-2xl font-bold text-foreground">Scegli il tuo pacchetto</h2>
          <p className="text-muted-foreground">
            La prova gratuita è solo verso il tuo numero.<br/>
            Per scherzare gli amici, acquista un pacchetto!
          </p>
        </div>

        {/* Countdown Timer */}
        {!countdown.expired && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-destructive font-semibold text-sm">
              <Clock className="w-4 h-4" />
              L'offerta scade tra:
            </div>
            <div className="flex items-center justify-center gap-3">
              {[
                { value: countdown.days, label: "giorni" },
                { value: countdown.hours, label: "ore" },
                { value: countdown.minutes, label: "min" },
                { value: countdown.seconds, label: "sec" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {String(item.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Promo Code Section */}
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Hai un codice promo?</span>
            </div>
            
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-mono font-semibold">{appliedPromo.code}</span>
                  <Badge variant="secondary">-{appliedPromo.discount_percentage}%</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={removePromoCode}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Inserisci codice"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase());
                    setPromoError(null);
                  }}
                  className="uppercase font-mono"
                  onKeyDown={(e) => e.key === "Enter" && validatePromoCode()}
                />
                <Button 
                  variant="outline" 
                  onClick={validatePromoCode}
                  disabled={promoLoading || !promoInput.trim()}
                >
                  {promoLoading ? (
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    "Applica"
                  )}
                </Button>
              </div>
            )}
            
            {promoError && (
              <p className="text-destructive text-sm mt-2">{promoError}</p>
            )}
          </CardContent>
        </Card>

        {/* Packages — direct checkout, no upsell */}
        <div className="space-y-4">
          {packages.map((pkg) => {
            const discountedPrice = getDiscountedPrice(pkg.price);
            const hasDiscount = discountedPrice < pkg.price;
            const discountedPerPrank = (discountedPrice / pkg.pranks).toFixed(2).replace(".", ",");
            
            return (
              <Card 
                key={pkg.id}
                className={`relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
                  pkg.recommended 
                    ? "border-primary shadow-lg ring-2 ring-primary/20" 
                    : "border-border"
                }`}
                onClick={() => handleCheckout(pkg.id)}
              >
                {pkg.recommended && (
                  <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
                    ⭐ Più scelto
                  </Badge>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl text-foreground">{pkg.name}</CardTitle>
                  <CardDescription>
                    {pkg.pranks} {pkg.pranks === 1 ? "chiamata prank" : "chiamate prank"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    {hasDiscount ? (
                      <>
                        <span className="text-4xl font-bold text-primary">
                          €{discountedPrice.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-lg text-muted-foreground line-through">
                          €{pkg.price.toFixed(2).replace(".", ",")}
                        </span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold text-primary">
                        €{pkg.price.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      €{discountedPerPrank} per prank
                    </span>
                    <Button 
                      className="bg-primary text-primary-foreground"
                      disabled={loading === pkg.id}
                    >
                      {loading === pkg.id ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Caricamento...
                        </span>
                      ) : (
                        <>
                          <Phone className="w-4 h-4 mr-2" />
                          Acquista
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features */}
        <Card className="bg-muted/30 border-border">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-4">Ogni prank include:</h3>
            <ul className="space-y-2">
              {[
                "Voce AI ultra-realistica",
                "Registrazione della chiamata",
                "Temi personalizzabili",
                "Supporto multilingua",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Pricing;
