/**
 * Audio Service - Manages audio files from R2
 * 
 * Downloads audio from R2 to local public/audio folder for Remotion rendering
 */

import { join } from "path";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { 
  listAudioFiles, 
  downloadAudioFromR2, 
  isR2Configured 
} from "../storage/r2";

const PUBLIC_AUDIO_DIR = join(process.cwd(), "public", "audio");

// Ensure audio directory exists
if (!existsSync(PUBLIC_AUDIO_DIR)) {
  mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
}

export interface LocalAudioFile {
  name: string;
  localPath: string;
  publicUrl: string;
  bpm?: number;
  duration?: number;
}

/**
 * Ensure audio files are available locally
 * Downloads from R2 if not present
 */
export async function ensureAudioAvailable(): Promise<LocalAudioFile[]> {
  if (!isR2Configured()) {
    console.log("[AudioService] R2 not configured, using local audio files only");
    return getLocalAudioFiles();
  }

  console.log("[AudioService] Syncing audio from R2...");
  
  try {
    const r2AudioFiles = await listAudioFiles();
    const localFiles: LocalAudioFile[] = [];

    for (const audioFile of r2AudioFiles) {
      const localPath = join(PUBLIC_AUDIO_DIR, `${audioFile.name}.mp3`);
      
      // Check if already downloaded
      if (!existsSync(localPath)) {
        console.log(`[AudioService] Downloading: ${audioFile.name}`);
        const success = await downloadAudioFromR2(audioFile.key, localPath);
        
        if (!success) {
          console.error(`[AudioService] Failed to download: ${audioFile.name}`);
          continue;
        }
      }

      localFiles.push({
        name: audioFile.name,
        localPath,
        publicUrl: `/audio/${audioFile.name}.mp3`,
        bpm: audioFile.bpm,
        duration: audioFile.duration,
      });
    }

    console.log(`[AudioService] ${localFiles.length} audio files ready`);
    return localFiles;
  } catch (error) {
    console.error("[AudioService] Error syncing audio:", error);
    return getLocalAudioFiles();
  }
}

/**
 * Get default audio file for video generation
 */
export async function getDefaultAudioFile(): Promise<LocalAudioFile | null> {
  const localFiles = await ensureAudioAvailable();
  
  if (localFiles.length === 0) {
    console.warn("[AudioService] No audio files available");
    return null;
  }

  // Look for default or audio1
  const defaultFile = localFiles.find(f => 
    f.name.toLowerCase().includes("default") || 
    f.name.toLowerCase().includes("audio1")
  );

  return defaultFile || localFiles[0];
}

/**
 * Get all local audio files
 */
function getLocalAudioFiles(): LocalAudioFile[] {
  if (!existsSync(PUBLIC_AUDIO_DIR)) {
    return [];
  }

  try {
    const files = readdirSync(PUBLIC_AUDIO_DIR);
    return files
      .filter((f: string) => f.endsWith(".mp3"))
      .map((f: string) => ({
        name: f.replace(".mp3", ""),
        localPath: join(PUBLIC_AUDIO_DIR, f),
        publicUrl: `/audio/${f}`,
      }));
  } catch (error) {
    console.error("[AudioService] Error reading local audio:", error);
    return [];
  }
}

/**
 * Get audio configuration for video generation
 */
export async function getAudioConfig(): Promise<{ url: string; bpm: number; duration: number } | null> {
  const defaultAudio = await getDefaultAudioFile();
  
  if (!defaultAudio) {
    // Fallback to first track from music_metadata.json (R2-hosted)
    return {
      url: "https://pub-52c4f36ed495483b84403a8cbd2d2ff3.r2.dev/hitslab-product-launch-advertising-commercial-music-301409.mp3",
      bpm: 120,
      duration: 30,
    };
  }

  return {
    url: defaultAudio.publicUrl,
    bpm: defaultAudio.bpm || 120,
    duration: defaultAudio.duration || 30,
  };
}

/**
 * Initialize audio service - call at server startup
 */
export async function initializeAudioService(): Promise<void> {
  console.log("[AudioService] Initializing...");
  await ensureAudioAvailable();
  console.log("[AudioService] Ready");
}
