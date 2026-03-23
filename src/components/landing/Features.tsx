import { motion } from "framer-motion";
import { Brain, LineChart, Building, Globe, Clock, Crosshair, ShieldCheck, Target } from "lucide-react";

const features = [
  { icon: Brain, title: "Análise com IA Avançada", desc: "Modelos de deep learning que processam milhões de dados em segundos.", span: "md:col-span-2" },
  { icon: LineChart, title: "Indicadores Técnicos", desc: "RSI, MACD, Bollinger Bands e mais de 50 indicadores integrados." },
  { icon: Building, title: "Análise Fundamentalista", desc: "Balanços, demonstrativos e métricas financeiras em tempo real." },
  { icon: Globe, title: "Notícias em Tempo Real", desc: "Feed de notícias filtradas por relevância e impacto no mercado." },
  { icon: Clock, title: "Heatmap de Horários", desc: "Identifique os melhores horários para operar cada ativo." },
  { icon: Crosshair, title: "Entry, Stop & Take Profit", desc: "Pontos de entrada, stop loss e take profit calculados pela IA.", span: "md:col-span-2" },
  { icon: ShieldCheck, title: "Gestão de Risco", desc: "Controle de exposição e sizing de posição automático." },
  { icon: Target, title: "Grau de Assertividade", desc: "Score de confiança da IA para cada análise gerada." },
];

const Features = () => (
  <section id="recursos" className="py-24 px-4 relative">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[150px]" />
    </div>

    <div className="max-w-6xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Recursos <span className="gradient-text">Poderosos</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Tudo que você precisa para operar melhor.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={`glass rounded-2xl p-6 group hover:-translate-y-1 hover:neon-border transition-all duration-300 ${f.span || ""}`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
              <f.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
