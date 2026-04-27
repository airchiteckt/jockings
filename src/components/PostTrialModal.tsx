import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Sparkles, ArrowRight, Gift } from "lucide-react";

interface PostTrialModalProps {
  open: boolean;
  onClose: () => void;
}

const PACKAGES = [
  { name: "Starter Pack", pranks: 3, price: 4.99, discounted: 2.49, perPrank: "0,83" },
  { name: "Mega Pack", pranks: 10, price: 14.99, discounted: 7.49, perPrank: "0,75", best: true },
];

const PostTrialModal = ({ open, onClose }: PostTrialModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-secondary/30">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary via-primary to-secondary p-5 sm:p-6 text-center text-primary-foreground">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Ti è piaciuto? 🎭</h2>
          <p className="text-primary-foreground/80 text-sm">
            Il tuo scherzo gratuito è terminato!
          </p>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Continua a divertirti con i tuoi amici! Scegli un pacchetto con lo 
            <span className="font-bold text-secondary"> sconto lancio del 30%</span>.
          </p>

          {/* Quick packages */}
          <div className="space-y-2">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.name}
                onClick={() => {
                  onClose();
                  navigate("/pricing");
                }}
                className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  pkg.best 
                    ? "border-secondary bg-secondary/5 shadow-md" 
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    pkg.best ? "bg-secondary/20 text-secondary" : "bg-primary/10 text-primary"
                  }`}>
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{pkg.name}</span>
                      {pkg.best && (
                        <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full font-bold">
                          BEST
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {pkg.pranks} scherzi · €{pkg.perPrank}/scherzo
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs line-through text-muted-foreground">€{pkg.price.toFixed(2)}</p>
                  <p className="font-bold text-sm text-foreground">€{pkg.discounted.toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>

          {/* CTA */}
          <Button
            className="w-full h-12 text-base font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            onClick={() => {
              onClose();
              navigate("/pricing");
            }}
          >
            <Gift className="w-5 h-5 mr-2" />
            Vedi tutti i pacchetti
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <button
            onClick={onClose}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Magari dopo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostTrialModal;
