import { motion } from "framer-motion";

interface LogoAnimationProps {
  onComplete?: () => void;
}

export function LogoAnimation({ onComplete }: LogoAnimationProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        onAnimationComplete={onComplete}
        className="relative"
      >
        <motion.h1 
          className="text-7xl font-bold tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="text-white">team</span>
          <motion.span 
            className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            ble
          </motion.span>
        </motion.h1>
        
        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 blur-3xl bg-gradient-to-r from-purple-500/30 to-pink-500/30 -z-10"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1.5 }}
          transition={{ delay: 0.2, duration: 1 }}
        />
      </motion.div>
    </div>
  );
}
