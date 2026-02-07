import { motion } from "framer-motion";

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  onComplete?: () => void;
}

export function FadeInText({ text, className = "", delay = 0, duration = 0.8, onComplete }: AnimatedTextProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className={className}
    >
      {text}
    </motion.div>
  );
}

export function SlideInText({ text, className = "", delay = 0, duration = 0.8, onComplete }: AnimatedTextProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className={className}
    >
      {text}
    </motion.div>
  );
}

export function TypewriterText({ text, className = "", delay = 0, onComplete }: AnimatedTextProps) {
  const characters = text.split("");
  
  return (
    <motion.div className={`inline-flex ${className}`}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            delay: delay + index * 0.05, 
            duration: 0.1 
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
      <motion.span
        className="inline-block w-0.5 h-full bg-purple-400 ml-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ 
          delay: delay + characters.length * 0.05, 
          duration: 0.8,
          repeat: 2
        }}
        onAnimationComplete={onComplete}
      />
    </motion.div>
  );
}

export function GradientText({ text, className = "", delay = 0 }: AnimatedTextProps) {
  return (
    <motion.span
      initial={{ opacity: 0, backgroundPosition: "0% 50%" }}
      animate={{ opacity: 1, backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
      transition={{ 
        delay,
        duration: 3,
        ease: "linear",
        repeat: Infinity
      }}
      className={`bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] ${className}`}
      style={{ backgroundSize: "200% auto" }}
    >
      {text}
    </motion.span>
  );
}

interface WordByWordProps {
  words: string[];
  className?: string;
  wordClassName?: string;
  delay?: number;
  onComplete?: () => void;
}

export function WordByWord({ words, className = "", wordClassName = "", delay = 0, onComplete }: WordByWordProps) {
  return (
    <motion.div className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ 
            delay: delay + index * 0.15, 
            duration: 0.5,
            ease: "easeOut"
          }}
          onAnimationComplete={index === words.length - 1 ? onComplete : undefined}
          className={wordClassName}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
}

interface ScrollingTextProps {
  texts: string[];
  className?: string;
  delay?: number;
}

export function ScrollingText({ texts, className = "", delay = 0 }: ScrollingTextProps) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: `-${(texts.length - 1) * 100}%` }}
        transition={{ 
          delay,
          duration: texts.length * 0.8,
          ease: "easeInOut",
          times: texts.map((_, i) => i / (texts.length - 1))
        }}
      >
        {texts.map((text, index) => (
          <div key={index} className="h-full flex items-center justify-center">
            {text}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
