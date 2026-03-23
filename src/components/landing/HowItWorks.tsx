import { motion } from "framer-motion";
import { MousePointerClick, Cpu, FileText, Rocket } from "lucide-react";

const steps = [
  { icon: MousePointerClick, title: "Escolha o Ativo", desc: "Selecione entre Forex, Cripto, Ações ou Índices." },
  { icon: Cpu, title: "A IA Processa os Dados", desc: "Nossos modelos analisam milhões de dados em tempo real." },
  { icon: FileText, title: "Receba a Tese Completa", desc: "Entry, Stop Loss e Take Profit calculados automaticamente." },
  { icon: Rocket, title: "Execute a Operação", desc: "Opere com confiança baseada em dados, não em emoção." },
];

const HowItWorks = () => (
  <section id="como-funciona" className="py-24 px-4 relative">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
    </div>

    <div className="max-w-5xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Simples e Direto: <span className="gradient-text">Como Funciona</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="relative"
          >
            <div className="glass rounded-2xl p-6 text-center h-full">
              <div className="text-5xl font-black gradient-text mb-4">0{i + 1}</div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-[2px] bg-gradient-to-r from-primary/60 to-accent/60" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
