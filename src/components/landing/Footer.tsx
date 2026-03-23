import { Activity } from "lucide-react";

const Footer = () => (
  <footer id="afiliados" className="border-t border-border/30 pt-16 pb-8 px-4">
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Katon AI</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Plataforma de trading com inteligência artificial para investidores modernos.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Produto</h4>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li><a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a></li>
            <li><a href="#planos" className="hover:text-foreground transition-colors">Planos</a></li>
            <li><a href="#como-funciona" className="hover:text-foreground transition-colors">Como Funciona</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Legal</h4>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
            <li><a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a></li>
            <li><a href="#" className="hover:text-foreground transition-colors">Aviso de Risco</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Contato</h4>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>suporte@katon.ai</li>
            <li><a href="#" className="hover:text-foreground transition-colors">Discord</a></li>
            <li><a href="#" className="hover:text-foreground transition-colors">Instagram</a></li>
          </ul>
          <div className="mt-4 glass rounded-lg p-3">
            <p className="text-xs font-semibold text-foreground mb-1">💰 Programa de Parceiros</p>
            <p className="text-xs text-muted-foreground">Ganhe dinheiro indicando. Comissões recorrentes.</p>
          </div>
        </div>
      </div>
      <div className="border-t border-border/30 pt-6 text-center text-xs text-muted-foreground">
        © 2026 Katon AI. Todos os direitos reservados. Investimentos envolvem riscos.
      </div>
    </div>
  </footer>
);

export default Footer;
