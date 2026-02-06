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
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const fetchAudioList = async () => {
    try {
      const response = await fetch("/api/audio");
      const data = await response.json();
      if (data.audio) {
        setAudioList(data.audio);
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
    setUploadProgress(0);

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
      setUploadProgress(0);
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
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {audioList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No audio files available</p>
              <p className="text-sm">Upload an audio file to get started</p>
            </div>
          ) : (
            audioList.map((audio) => (
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
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
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
