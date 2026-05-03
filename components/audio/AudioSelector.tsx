"use client";

import React, { useState, useRef, useEffect } from "react";
import { Music, Upload, Play, Pause, Check, Volume2, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

interface AudioFile {
  key: string;
  name: string;
  url: string;
  bpm?: number;
  duration?: number;
  moods?: string[];
}

interface AudioSelectorProps {
  selectedAudio: AudioFile | null;
  onSelect: (audio: AudioFile) => void;
}

export function AudioSelector({ selectedAudio, onSelect }: AudioSelectorProps) {
  const [audioList, setAudioList] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch audio list on mount
  useEffect(() => {
    fetchAudioList();
  }, []);

  // Stop audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update parent's selectedAudio when duration becomes available
  useEffect(() => {
    if (selectedAudio && !selectedAudio.duration) {
      const updated = audioList.find((a) => a.key === selectedAudio.key);
      if (updated?.duration) {
        onSelect(updated);
      }
    }
  }, [audioList, selectedAudio, onSelect]);

  const probeAudioDuration = (url: string): Promise<number | undefined> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      const cleanup = () => { audio.src = ""; };
      audio.addEventListener("loadedmetadata", () => {
        const dur = isFinite(audio.duration) ? Math.floor(audio.duration) : undefined;
        cleanup();
        resolve(dur);
      }, { once: true });
      audio.addEventListener("error", () => { cleanup(); resolve(undefined); }, { once: true });
      // Timeout after 8s
      setTimeout(() => { cleanup(); resolve(undefined); }, 8000);
      audio.src = url;
    });
  };

  const fetchAudioList = async () => {
    try {
      const response = await fetch("/api/audio");
      const data = await response.json();
      if (data.audio) {
        setAudioList(data.audio);
        // Probe durations for tracks missing them
        const tracksNeedingDuration = (data.audio as AudioFile[]).filter((a) => !a.duration && a.url);
        if (tracksNeedingDuration.length > 0) {
          // Probe in batches of 5 to avoid overwhelming the browser
          const batchSize = 5;
          for (let i = 0; i < tracksNeedingDuration.length; i += batchSize) {
            const batch = tracksNeedingDuration.slice(i, i + batchSize);
            const results = await Promise.all(
              batch.map(async (track) => ({
                key: track.key,
                duration: await probeAudioDuration(track.url),
              }))
            );
            setAudioList((prev) =>
              prev.map((a) => {
                const result = results.find((r) => r.key === a.key);
                return result?.duration ? { ...a, duration: result.duration } : a;
              })
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch audio:", error);
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (audio: AudioFile) => {
    if (playing === audio.key) {
      // Pause current
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audio.url);
      audioRef.current.play();
      setPlaying(audio.key);
      
      audioRef.current.onended = () => {
        setPlaying(null);
      };
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      // Try to extract BPM from filename or use default
      const bpmMatch = file.name.match(/(\d+)\s*bpm/i);
      if (bpmMatch) {
        formData.append("bpm", bpmMatch[1]);
      }

      const response = await fetch("/api/audio/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setAudioList((prev) => [...prev, data.audio]);
        onSelect(data.audio);
      } else {
        console.error("Upload failed:", data.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Unique moods across all tracks for the filter chips
  const allMoods = Array.from(
    new Set(audioList.flatMap((a) => a.moods || []))
  ).sort();

  const filteredAudio = activeMood
    ? audioList.filter((a) => a.moods?.includes(activeMood))
    : audioList;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Spinner className="w-6 h-6" />
            <span className="ml-2 text-muted-foreground">Loading audio...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="w-5 h-5" />
            Background Music
          </CardTitle>
          <input
            type="file"
            ref={fileInputRef}
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Audio
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Mood filter chips */}
        {allMoods.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setActiveMood(null)}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                !activeMood
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              All
            </button>
            {allMoods.map((mood) => (
              <button
                key={mood}
                onClick={() => setActiveMood(activeMood === mood ? null : mood)}
                className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors capitalize ${
                  activeMood === mood
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {mood}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {filteredAudio.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
              {activeMood ? (
                <>
                  <p>No tracks match <span className="capitalize">{activeMood}</span></p>
                  <p className="text-sm">Try another mood or select All</p>
                </>
              ) : (
                <>
                  <p>No audio files available</p>
                  <p className="text-sm">Upload an audio file to get started</p>
                </>
              )}
            </div>
          ) : (
            filteredAudio.map((audio) => (
              <div
                key={audio.key}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedAudio?.key === audio.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
                onClick={() => onSelect(audio)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    playAudio(audio);
                  }}
                >
                  {playing === audio.key ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{audio.name}</span>
                    {selectedAudio?.key === audio.key && (
                      <Badge variant="default" className="shrink-0">
                        <Check className="w-3 h-3 mr-1" />
                        Selected
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                    {audio.bpm && (
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {audio.bpm} BPM
                      </span>
                    )}
                    {audio.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(audio.duration)}
                      </span>
                    )}
                    {audio.moods?.slice(0, 2).map((mood) => (
                      <span
                        key={mood}
                        className="text-xs px-1.5 py-0.5 bg-muted rounded capitalize"
                      >
                        {mood}
                      </span>
                    ))}
                  </div>
                </div>

                {playing === audio.key && (
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-4 bg-primary animate-pulse" />
                    <div className="w-1 h-6 bg-primary animate-pulse delay-75" />
                    <div className="w-1 h-3 bg-primary animate-pulse delay-150" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedAudio && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Volume2 className="w-4 h-4" />
              <span className="font-medium">Selected:</span>
              <span className="truncate">{selectedAudio.name}</span>
              {selectedAudio.bpm && (
                <Badge variant="secondary" className="ml-auto">
                  {selectedAudio.bpm} BPM
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type { AudioFile };
