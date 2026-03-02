"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import dynamic from "next/dynamic";
import { ComponentType } from "react";
import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { ArrowRight, Play, Pause } from "lucide-react";

const CircularGallery = dynamic(
  () =>
    import("@/components/ui/CircularGallery").then(
      (mod) => mod.default as ComponentType<any>,
    ),
  {
    ssr: false,
  },
);

const TYPING_TEXTS = [
  "SaaS product demos",
  "stunning motion graphics",
  "explainer videos",
  "app promo videos",
];

const TypewriterText = () => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const text = TYPING_TEXTS[currentTextIndex];

    if (isPaused) {
      const pauseTimer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000);
      return () => clearTimeout(pauseTimer);
    }

    if (isDeleting) {
      if (currentText === "") {
        setIsDeleting(false);
        setCurrentTextIndex((prev) => (prev + 1) % TYPING_TEXTS.length);
      } else {
        const timer = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1));
        }, 50);
        return () => clearTimeout(timer);
      }
    } else {
      if (currentText === text) {
        setIsPaused(true);
      } else {
        const timer = setTimeout(() => {
          setCurrentText(text.slice(0, currentText.length + 1));
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [currentText, currentTextIndex, isDeleting, isPaused]);

  return (
    <span className="relative">
      <span>{currentText}</span>
      <span className="animate-pulse ml-0.5">|</span>
    </span>
  );
};

const FEATURES = [
  {
    title: "AI-Powered Generation",
    subtitle: "Smart Scripts",
    description:
      "Advanced AI agents analyze your content and generate compelling video scripts",
    image:
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80",
  },
  {
    title: "Pro Rendering",
    subtitle: "Studio Quality",
    description:
      "Professional-grade video rendering with smooth animations and transitions",
    image:
      "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80",
  },
  {
    title: "Beat Synchronized",
    subtitle: "Perfect Timing",
    description:
      "Animations automatically sync to music beats for engaging content",
    image:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
  },
  {
    title: "Export Anywhere",
    subtitle: "4K Quality",
    description: "Download in multiple formats including 4K for any platform",
    image:
      "https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?w=800&q=80",
  },
];

const VIDEO_TYPES = [
  {
    title: "Product Launch",
    subtitle: "Cinematic announcements",
    year: "2024",
    image:
      "https://images.unsplash.com/photo-1549490349-8643362247b5?w=600&q=80",
  },
  {
    title: "Explainer Videos",
    subtitle: "Clear & engaging",
    year: "2024",
    image:
      "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&q=80",
  },
  {
    title: "Motion Graphics",
    subtitle: "Dynamic visuals",
    year: "2024",
    image:
      "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&q=80",
  },
  {
    title: "Info Videos",
    subtitle: "Data-driven",
    year: "2024",
    image:
      "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=600&q=80",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [galleryItems, setGalleryItems] = useState<
    { image: string; text: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/renders")
      .then((res) => res.json())
      .then((data) => {
        if (data.videos && data.videos.length > 0) {
          // limit to 10 for performance
          const selected = data.videos
            .slice(0, 10)
            .map((url: string, i: number) => ({
              image: url,
              text: `Generated Video ${i + 1}`,
            }));
          setGalleryItems(selected);
        }
      })
      .catch((err) => console.error("Failed to load videos for gallery:", err));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      {/* Film Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Navigation with Logo */}
      <Navbar transparent={true} />

      {/* Hero Section - Renaissance Style using ScrollExpandMedia */}
      <ScrollExpandMedia
        mediaType="video"
        mediaSrc="https://me7aitdbxq.ufs.sh/f/2wsMIGDMQRdYuZ5R8ahEEZ4aQK56LizRdfBSqeDMsmUIrJN1"
        posterSrc="https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80"
        bgImageSrc="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=1920&auto=format&fit=crop"
        title="SaaS Demos in Minutes"
        date="AI-Powered"
        scrollToExpand="Scroll to Experience"
        textBlend={true}
      >
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mt-24">
          <div className="text-sm tracking-widest text-gray-500 uppercase mb-8">
            <span className="block">AI Video Production</span>
          </div>

          <div className="mb-12">
            <p className="text-lg md:text-2xl text-gray-300 mb-4 font-light">
              Create stunning
            </p>
            <div className="text-3xl md:text-5xl font-light mb-4 text-white">
              <TypewriterText />
            </div>
            <p className="text-lg md:text-2xl text-gray-300 font-light">
              in minutes with AI
            </p>
          </div>

          <p className="text-lg text-gray-400 leading-relaxed mb-12 max-w-2xl">
            The world&apos;s first AI-powered video generation platform for
            SaaS. Transform screen recordings and URLs into professional motion
            graphics and product demos in under 5 minutes. No timeline editing
            required.
          </p>

          <button
            onClick={() => router.push("/projects")}
            className="group flex items-center gap-4 text-xl tracking-wider uppercase text-white hover:text-gray-300 transition-colors border border-white/20 px-8 py-4 rounded-full hover:bg-white/5 bg-black/50 backdrop-blur-sm"
          >
            <span>Start Creating</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </ScrollExpandMedia>

      {/* Video Gallery Section - Circular WebGL Showcase */}
      {galleryItems.length > 0 && (
        <section className="py-24 md:py-32 px-6 md:px-0 border-t border-white/10 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-12 mb-16 relative z-10 pointer-events-none">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase">
              Gallery
            </span>
            <h2 className="text-4xl md:text-5xl font-light mt-4">
              Made with ReMawt
            </h2>
          </div>

          <div className="w-full relative h-[600px] mt-8 bg-black">
            <CircularGallery
              items={galleryItems}
              bend={3}
              textColor="#ffffff"
              borderRadius={0.05}
              scrollSpeed={3}
              className="absolute inset-0"
            />
          </div>
        </section>
      )}

      {/* Video Types Grid - Bruegel Style */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10">
            {VIDEO_TYPES.map((type, i) => (
              <div
                key={i}
                className="bg-[#0a0a0a] p-8 group hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => router.push("/projects")}
              >
                <div className="aspect-[4/5] mb-6 overflow-hidden">
                  <img
                    src={type.image}
                    alt={type.title}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                <div className="text-xs text-gray-600 tracking-widest mb-4">
                  {type.year}
                </div>
                <h3 className="text-2xl font-light mb-2 tracking-wide">
                  {type.title}
                </h3>
                <p className="text-sm text-gray-500 tracking-wider uppercase">
                  {type.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Magazine Layout */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase">
              Features
            </span>
            <h2 className="text-4xl md:text-5xl font-light mt-4">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-white/10">
            {FEATURES.map((feature, i) => (
              <Card
                key={i}
                className="bg-[#0a0a0a] border-0 rounded-none group hover:bg-white/5 transition-colors"
              >
                <CardContent className="p-8 md:p-12">
                  <div className="aspect-video mb-8 overflow-hidden">
                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                  <div className="text-xs tracking-[0.2em] text-gray-600 uppercase mb-4">
                    {feature.subtitle}
                  </div>
                  <h3 className="text-2xl font-light mb-4">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Steps - Timeline Style */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase">
              Process
            </span>
            <h2 className="text-4xl md:text-5xl font-light mt-4">Four Steps</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Describe",
                desc: "Enter your product URL or description",
                image:
                  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200&q=80",
              },
              {
                step: "02",
                title: "Generate",
                desc: "AI creates your video script & scenes",
                image:
                  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=200&q=80",
              },
              {
                step: "03",
                title: "Preview",
                desc: "Review and customize the animation",
                image:
                  "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=200&q=80",
              },
              {
                step: "04",
                title: "Export",
                desc: "Download your professional video",
                image:
                  "https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?w=200&q=80",
              },
            ].map((item, i) => (
              <div key={i} className="border-t border-white/20 pt-8">
                <div className="w-16 h-16 mb-6 overflow-hidden rounded-full">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover grayscale"
                  />
                </div>
                <div className="text-5xl font-light text-gray-700 mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-light mb-3 tracking-wide">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audio/Visual Section - Bruegel Style */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs tracking-[0.3em] text-gray-600 uppercase">
                Audio Guide
              </span>
              <h2 className="text-4xl md:text-5xl font-light mt-4 mb-8">
                Experience the Process
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Listen to how our AI transforms simple descriptions into
                cinematic video content. From script to screen in minutes.
              </p>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-4 text-sm tracking-wider uppercase hover:text-gray-400 transition-colors"
              >
                <div className="w-10 h-10 border border-white/30 flex items-center justify-center">
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white" />
                  )}
                </div>
                <span>{isPlaying ? "Pause" : "Play"} Introduction</span>
              </button>
            </div>

            <div className="aspect-video bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Vincent_van_Gogh_-_Almond_blossom_-_Google_Art_Project.jpg/640px-Vincent_van_Gogh_-_Almond_blossom_-_Google_Art_Project.jpg"
                alt="Video Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Large CTA Section */}
      <section className="py-32 md:py-48 px-6 md:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-[8vw] md:text-[6vw] font-light leading-[0.9] mb-8">
            Ready to Create?
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-12">
            Join thousands of creators producing professional videos with AI. No
            experience required.
          </p>
          <button
            onClick={() => router.push("/projects")}
            className="px-12 py-4 border border-white text-lg tracking-wider uppercase hover:bg-white hover:text-black transition-all"
          >
            Start For Free
          </button>
        </div>
      </section>

      {/* Footer with Logo */}
      <Footer />
    </div>
  );
}
