"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useVideoStore } from "@/lib/store";
import {
  Button,
  Input,
  TextArea,
  Card,
  Select,
  Tabs,
  TabPanel,
  Progress,
  StepsProgress,
} from "@/components/ui";

const STYLE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "minimal", label: "Minimal" },
  { value: "bold", label: "Bold" },
];

const GENERATION_STEPS = [
  { id: "scraping", label: "Analyze" },
  { id: "scripting", label: "Script" },
  { id: "generating", label: "Generate" },
  { id: "complete", label: "Complete" },
];

export default function Home() {
  const router = useRouter();
  const {
    sourceUrl,
    description,
    preferences,
    activeTab,
    isGenerating,
    generation,
    setSourceUrl,
    setDescription,
    setPreferences,
    setActiveTab,
    generateVideo,
  } = useVideoStore();

  const handleGenerate = async () => {
    await generateVideo();

    // Redirect to studio if successful
    if (generation.projectId && generation.step === "complete") {
      router.push(`/studio/${generation.projectId}`);
    }
  };

  const isInputValid =
    (activeTab === "url" && sourceUrl.trim()) ||
    (activeTab === "description" && description.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            AI Video Generator
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Transform your product website or description into a stunning
            marketing video in minutes. Powered by AI agents and Remotion.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 pb-20 -mt-8">
        <Card className="shadow-xl">
          {/* Input Tabs */}
          <Tabs
            tabs={[
              {
                id: "url",
                label: "Website URL",
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                ),
              },
              {
                id: "description",
                label: "Description",
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h7"
                    />
                  </svg>
                ),
              },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as "url" | "description")}
          />

          {/* URL Input */}
          <TabPanel isActive={activeTab === "url"}>
            <Input
              label="Product Website URL"
              type="url"
              placeholder="https://example.com/product"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              helperText="Enter your product landing page URL to automatically extract content"
              disabled={isGenerating}
            />
          </TabPanel>

          {/* Description Input */}
          <TabPanel isActive={activeTab === "description"}>
            <TextArea
              label="Product Description"
              placeholder="Describe your product, its features, and target audience..."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              helperText="Write a detailed description of your product for the AI to work with"
              disabled={isGenerating}
            />
          </TabPanel>

          {/* Style Selection */}
          <div className="mt-6">
            <Select
              label="Video Style"
              options={STYLE_OPTIONS}
              value={preferences.style}
              onChange={(value) =>
                setPreferences({
                  style: value as "professional" | "playful" | "minimal" | "bold",
                })
              }
              disabled={isGenerating}
            />
          </div>

          {/* Generation Progress */}
          {isGenerating && (
            <div className="mt-8 space-y-4">
              <StepsProgress
                steps={GENERATION_STEPS}
                currentStep={generation.step}
              />
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {generation.message}
                </p>
                <Progress value={generation.progress} showLabel />
              </div>
            </div>
          )}

          {/* Errors */}
          {generation.errors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Generation Failed
              </h4>
              <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                {generation.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Generate Button */}
          <div className="mt-8">
            <Button
              onClick={handleGenerate}
              disabled={!isInputValid || isGenerating}
              loading={isGenerating}
              size="lg"
              className="w-full"
            >
              {isGenerating ? "Generating Video..." : "Generate Video"}
            </Button>
          </div>

          {/* Success - Go to Studio */}
          {generation.step === "complete" && generation.projectId && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Video Generated Successfully!
                  </h4>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Your video is ready to preview and export.
                  </p>
                </div>
                <Button
                  onClick={() => router.push(`/studio/${generation.projectId}`)}
                  variant="primary"
                  size="sm"
                >
                  Open Studio
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Features Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🤖"
            title="AI-Powered"
            description="Multiple AI agents work together to analyze, script, and generate your video"
          />
          <FeatureCard
            icon="🎬"
            title="Remotion Engine"
            description="Professional video rendering with React-based animation system"
          />
          <FeatureCard
            icon="🎵"
            title="Beat Synced"
            description="Animations automatically sync to music beats for engaging content"
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}
