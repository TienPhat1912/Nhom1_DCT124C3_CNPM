import { LanguageCode } from './language';

export interface AudioTrack {
  language: LanguageCode;
  title: string;
  narratorName: string;
  audioUrl: string;
  durationSeconds: number;
  transcriptText: string;
}

export interface AudioGuide {
  id: string;
  locationId: string;
  tracks: Record<LanguageCode, AudioTrack>;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface PlaybackState {
  status: PlaybackStatus;
  positionMillis: number;
  durationMillis: number;
  progress: number; // 0.0 to 1.0
  isBuffering: boolean;
  errorMessage?: string;
}
