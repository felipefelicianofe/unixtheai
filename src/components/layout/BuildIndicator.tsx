import React from 'react';
import buildInfo from '@/version.json';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export const BuildIndicator: React.FC = () => {
    // A cada vez que o app monta, ele lê o version.json compilado no bundle.
    // O deploy-all.ps1 irá atualizar esse arquivo antes de subir.
    const shortHash = buildInfo.buildHash.slice(0, 7);

    return (
        <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-2 py-1 rounded bg-secondary/20 border border-border/40"
        >
            <div className="relative">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-emerald-500 rounded-full"
                />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
                Build: <span className="text-foreground font-bold">{shortHash}</span>
            </span>
            <div className="h-2 w-[1px] bg-border/40 mx-1" />
            <span className="text-[9px] font-medium text-muted-foreground/60 leading-none">
                {new Date(buildInfo.buildTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
        </motion.div>
    );
};
