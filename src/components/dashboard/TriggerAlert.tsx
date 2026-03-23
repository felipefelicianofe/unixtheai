import { motion, AnimatePresence } from "framer-motion";
import { Radio } from "lucide-react";

interface Props {
  triggered: boolean;
  message: string | null;
}

const TriggerAlert = ({ triggered, message }: Props) => (
  <AnimatePresence>
    {triggered && message && (
      <motion.div
        initial={{ opacity: 0, height: 0, y: -10 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -10 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="glass rounded-2xl p-4 border border-accent/40 bg-accent/5 relative">
          {/* Radar glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-accent/30"
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.02, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Radio className="w-5 h-5 text-accent" />
            </motion.div>
            <span className="text-sm font-medium text-accent">
              {message}
            </span>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default TriggerAlert;
