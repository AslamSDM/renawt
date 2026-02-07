"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { LogoAnimation } from "./LogoAnimation";
import { FadeInText, WordByWord } from "./TextAnimations";
import { 
  NotificationCard, 
  OneOnOnePrepCard, 
  FeedbackForm, 
  FeedbackScoreCard,
  Dashboard,
  EnhancedFeedbackCard,
  TeambleLogo 
} from "./UIMockups";

interface DemoVideoPlayerProps {
  onComplete?: () => void;
}

export function DemoVideoPlayer({ onComplete }: DemoVideoPlayerProps) {
  const [scene, setScene] = useState(0);
  const [bgClass, setBgClass] = useState("gradient-aurora");

  const nextScene = useCallback(() => {
    setScene(prev => {
      const next = prev + 1;
      if (next >= 20) {
        onComplete?.();
        return prev;
      }
      return next;
    });
  }, [onComplete]);

  // Auto-advance scenes
  useEffect(() => {
    const durations = [
      2500,  // 0: Logo
      2000,  // 1: Tagline
      2500,  // 2: Introduces teamble ai
      2000,  // 3: Give your teams
      2500,  // 4: superpowers
      2000,  // 5: Help them
      2500,  // 6: unlock their potential
      2000,  // 7: 9x better Feedback
      2500,  // 8: Notification card
      3000,  // 9: 1-on-1 prep
      2500,  // 10: Feedback form
      2000,  // 11: Help me craft
      2500,  // 12: Generating
      3000,  // 13: Feedback score
      3000,  // 14: Score details
      2500,  // 15: Making feedback specific
      3000,  // 16: From just managing
      3000,  // 17: to truly coaching
      3000,  // 18: Unlock insights
      4000,  // 19: Dashboard
    ];

    if (scene < durations.length) {
      const timer = setTimeout(nextScene, durations[scene]);
      return () => clearTimeout(timer);
    }
  }, [scene, nextScene]);

  // Background transitions
  useEffect(() => {
    if (scene >= 3 && scene <= 7) {
      setBgClass("gradient-aurora-light");
    } else if (scene >= 8) {
      setBgClass(scene % 2 === 0 ? "gradient-aurora" : "gradient-aurora-light");
    }
  }, [scene]);

  return (
    <div className={`w-full h-screen ${bgClass} overflow-hidden relative transition-all duration-1000`}>
      <AnimatePresence mode="wait">
        {/* Scene 0: Logo Animation */}
        {scene === 0 && (
          <motion.div
            key="scene0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <LogoAnimation />
          </motion.div>
        )}

        {/* Scene 1: Tagline */}
        {scene === 1 && (
          <motion.div
            key="scene1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <FadeInText 
              text="The People Success Platform" 
              className="text-4xl md:text-5xl font-semibold text-white text-center"
              delay={0.2}
            />
          </motion.div>
        )}

        {/* Scene 2: Introduces teamble ai */}
        {scene === 2 && (
          <motion.div
            key="scene2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.span 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl md:text-4xl text-gray-400"
              >
                Introduces
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold ml-3"
              >
                <span className="text-white">teamble</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"> ai</span>
              </motion.span>
            </div>
          </motion.div>
        )}

        {/* Scene 3-7: Value Proposition */}
        {scene === 3 && (
          <motion.div
            key="scene3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <WordByWord 
              words={["Give", "your", "teams"]}
              wordClassName="text-5xl md:text-6xl font-bold"
              delay={0.2}
            />
          </motion.div>
        )}

        {scene === 4 && (
          <motion.div
            key="scene4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-5xl md:text-6xl font-bold text-gray-400"
              >
                your team{" "}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500"
              >
                superpowers
              </motion.span>
            </div>
          </motion.div>
        )}

        {scene === 5 && (
          <motion.div
            key="scene5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <WordByWord 
              words={["Help", "them"]}
              wordClassName="text-5xl md:text-6xl font-bold text-white"
              delay={0.2}
            />
          </motion.div>
        )}

        {scene === 6 && (
          <motion.div
            key="scene6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <WordByWord 
              words={["unlock", "their", "potential"]}
              wordClassName="text-5xl md:text-6xl font-bold"
              delay={0.2}
            />
          </motion.div>
        )}

        {scene === 7 && (
          <motion.div
            key="scene7"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.span className="text-4xl md:text-5xl font-medium text-gray-600">
                with{" "}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="inline-block px-8 py-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full"
              >
                <span className="text-4xl md:text-5xl font-bold text-gray-800">10x better</span>
              </motion.span>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-6"
              >
                <span className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500">
                  Feedback
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Scene 8: Notification Card */}
        {scene === 8 && (
          <motion.div
            key="scene8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <NotificationCard
              title="teamble ai"
              message="Good morning Mike, you have a 1-on-1 with Taylor"
              actionText="Prepare"
              delay={0.2}
            />
          </motion.div>
        )}

        {/* Scene 9: 1-on-1 Prep */}
        {scene === 9 && (
          <motion.div
            key="scene9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center p-8"
          >
            <OneOnOnePrepCard delay={0.2} />
          </motion.div>
        )}

        {/* Scene 10: Feedback Form */}
        {scene === 10 && (
          <motion.div
            key="scene10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <FeedbackForm delay={0.2} />
          </motion.div>
        )}

        {/* Scene 11: Help me craft */}
        {scene === 11 && (
          <motion.div
            key="scene11"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="px-12 py-6 bg-gradient-to-r from-purple-100 via-pink-100 to-purple-100 rounded-full"
            >
              <span className="text-3xl md:text-4xl font-semibold text-gray-800">Help me craft feedback</span>
            </motion.div>
          </motion.div>
        )}

        {/* Scene 12: Generating */}
        {scene === 12 && (
          <motion.div
            key="scene12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto mb-6"
              >
                <TeambleLogo size="lg" />
              </motion.div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-2xl text-gray-600"
              >
                Generating...
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* Scene 13: Feedback Score */}
        {scene === 13 && (
          <motion.div
            key="scene13"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <FeedbackScoreCard delay={0.2} />
          </motion.div>
        )}

        {/* Scene 14: Score Details */}
        {scene === 14 && (
          <motion.div
            key="scene14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="relative">
              <motion.span
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute -left-32 top-1/2 -translate-y-1/2 text-3xl text-gray-400"
              >
                10x better
              </motion.span>
              <FeedbackScoreCard delay={0.2} />
              <motion.span
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute -right-20 top-1/2 -translate-y-1/2 text-3xl text-gray-400"
              >
                feedback
              </motion.span>
            </div>
          </motion.div>
        )}

        {/* Scene 15: Making feedback specific */}
        {scene === 15 && (
          <motion.div
            key="scene15"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex items-center gap-8">
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl"
              >
                ✨
              </motion.div>
              <WordByWord 
                words={["Making", "feedback", "specific"]}
                wordClassName="text-5xl md:text-6xl font-bold text-white"
                delay={0.3}
              />
            </div>
          </motion.div>
        )}

        {/* Scene 16: From just managing */}
        {scene === 16 && (
          <motion.div
            key="scene16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl text-gray-600 mb-4"
              >
                Teamble AI helps your managers go from
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl"
              >
                <p className="text-gray-500 mb-2">Your initial feedback</p>
                <p className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
                  Taylor stumbled at the client demo
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <TeambleLogo size="sm" />
                  <span className="text-gray-600">Teamble AI feedback score</span>
                  <span className="text-red-500 font-bold">4/100</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Scene 17: To truly coaching */}
        {scene === 17 && (
          <motion.div
            key="scene17"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl text-gray-600 mb-4"
              >
                to
              </motion.p>
              <EnhancedFeedbackCard delay={0.3} />
            </div>
          </motion.div>
        )}

        {/* Scene 18: Unlock insights */}
        {scene === 18 && (
          <motion.div
            key="scene18"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <WordByWord 
                words={["Unlock", "actionable", "insights"]}
                wordClassName="text-5xl md:text-6xl font-bold"
                delay={0.2}
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-6 text-2xl"
              >
                with{" "}
                <span className="font-bold text-white">teamble</span>
                <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"> ai</span>
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* Scene 19: Dashboard */}
        {scene === 19 && (
          <motion.div
            key="scene19"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center p-8"
          >
            <Dashboard delay={0.2} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === scene ? "bg-purple-500 w-6" : i < scene ? "bg-purple-300" : "bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default DemoVideoPlayer;
