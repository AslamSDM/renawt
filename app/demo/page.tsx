"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DemoVideoPlayer } from "@/components/video/DemoVideoPlayer";
import { Play, Pause, RotateCcw } from "lucide-react";

export default function DemoPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const handleStart = () => {
    setIsPlaying(true);
    setHasCompleted(false);
  };

  const handleComplete = useCallback(() => {
    setHasCompleted(true);
    setIsPlaying(false);
  }, []);

  const handleRestart = () => {
    setIsPlaying(false);
    setHasCompleted(false);
    setTimeout(() => setIsPlaying(true), 100);
  };

  return (
    <div className="min-h-screen bg-black">
      <AnimatePresence mode="wait">
        {!isPlaying ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen gradient-aurora flex flex-col items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-6xl md:text-8xl font-bold mb-4">
                <span className="text-white">teamble</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"> ai</span>
              </h1>
              <p className="text-xl text-gray-400 mb-8">The People Success Platform</p>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleStart}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-6 text-lg rounded-full flex items-center gap-2 transition-all"
                >
                  <Play className="w-5 h-5" />
                  Play Video
                </button>
                
                {hasCompleted && (
                  <button
                    onClick={handleRestart}
                    className="border border-purple-500 text-purple-400 hover:bg-purple-500/10 px-8 py-6 text-lg rounded-full flex items-center gap-2 transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Replay
                  </button>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl"
            >
              {[
                { title: "AI-Powered Feedback", desc: "Get 10x better feedback with AI assistance" },
                { title: "1-on-1 Prep", desc: "Prepare for meetings with AI insights" },
                { title: "Team Analytics", desc: "Unlock actionable insights from your data" },
              ].map((feature, i) => (
                <div key={i} className="glass rounded-2xl p-6 text-center">
                  <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative"
          >
            <DemoVideoPlayer onComplete={handleComplete} />
            
            {/* Video controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-50">
              <button
                onClick={() => setIsPlaying(false)}
                className="bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm p-2 rounded-lg transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
