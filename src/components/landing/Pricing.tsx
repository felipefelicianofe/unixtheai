import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Básico",
    monthlyPrice: 97,
    yearlyPrice: 67,
    features: [
      "Análises ilimitadas de Forex",
      "Indicadores técnicos básicos",
      "Notícias em tempo real",
      "Suporte por e-mail",
      "1 dispositivo",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    monthlyPrice: 197,
    yearlyPrice: 137,
    features: [
      "Tudo do Básico",
      "Forex, Cripto, B3 e Índices",
      "IA avançada + Fundamentalista",
      "Heatmap de horários",
      "Gestão de risco automática",
      "Entry, Stop & Take Profit",
      "Suporte prioritário 24/7",
      "Dispositivos ilimitados",
    ],
    highlighted: true,
  },
];

const Pricing = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="planos" className="py-24 px-4 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[200px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Escolha seu <span className="gradient-text">Plano</span>
          </h2>
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Mensal</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={`text-sm ${annual ? "text-foreground" : "text-muted-foreground"}`}>
              Anual <Badge variant="secondary" className="ml-1 text-xs bg-accent/20 text-accent border-0">4 meses grátis!</Badge>
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`rounded-2xl p-8 relative ${
                plan.highlighted
                  ? "glass neon-border scale-[1.02]"
                  : "glass"
              }`}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 px-4">
                  Mais Popular
                </Badge>
              )}
              <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-foreground">
                  R$ {annual ? plan.yearlyPrice : plan.monthlyPrice}
                </span>
                <span className="text-muted-foreground text-sm">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-[hsl(var(--neon-green))] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground neon-glow"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                Começar Agora
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
