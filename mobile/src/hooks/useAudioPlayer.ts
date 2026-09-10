import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { PlaybackState } from '../types';

export function useAudioPlayer(audioUrl?: string) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    status: 'idle',
    positionMillis: 0,
    durationMillis: 0,
    progress: 0,
    isBuffering: false,
    errorMessage: undefined,
  });

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setPlaybackState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: status.error || 'Lỗi phát tệp âm thanh',
        }));
      }
      return;
    }

    const duration = status.durationMillis || 1;
    const position = status.positionMillis || 0;
    const progress = Math.min(Math.max(position / duration, 0), 1);

    setPlaybackState({
      status: status.isPlaying ? 'playing' : status.didJustFinish ? 'stopped' : 'paused',
      positionMillis: position,
      durationMillis: status.durationMillis || 0,
      progress,
      isBuffering: status.isBuffering,
      errorMessage: undefined,
    });
  }, []);

  // Tải âm thanh khi URL thay đổi
  useEffect(() => {
    let isCancelled = false;

    async function loadAudio() {
      if (!audioUrl) return;

      try {
        // Dọn dẹp âm thanh cũ nếu có
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        setPlaybackState((prev) => ({
          ...prev,
          status: 'loading',
          isBuffering: true,
          errorMessage: undefined,
        }));

        // Thiết lập cấu hình Audio Mode
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 500 },
          onPlaybackStatusUpdate
        );

        if (isCancelled) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        setPlaybackState((prev) => ({
          ...prev,
          status: 'paused',
          isBuffering: false,
        }));
      } catch (err: any) {
        if (!isCancelled) {
          setPlaybackState((prev) => ({
            ...prev,
            status: 'error',
            isBuffering: false,
            errorMessage: err.message || 'Không thể tải tệp âm thanh',
          }));
        }
      }
    }

    loadAudio();

    return () => {
      isCancelled = true;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [audioUrl, onPlaybackStatusUpdate]);

  const play = async () => {
    try {
      if (soundRef.current) {
        // Nếu đã phát xong thì phát lại từ đầu
        if (playbackState.status === 'stopped') {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
      }
    } catch (err: any) {
      setPlaybackState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message || 'Không thể phát âm thanh',
      }));
    }
  };

  const pause = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
    } catch (err: any) {
      setPlaybackState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message || 'Không thể tạm dừng âm thanh',
      }));
    }
  };

  const togglePlayPause = async () => {
    if (playbackState.status === 'playing') {
      await pause();
    } else {
      await play();
    }
  };

  const seekTo = async (progressPercent: number) => {
    try {
      if (soundRef.current && playbackState.durationMillis > 0) {
        const targetMillis = Math.floor(progressPercent * playbackState.durationMillis);
        await soundRef.current.setPositionAsync(targetMillis);
      }
    } catch (err: any) {
      // Ignored non-fatal seek error
    }
  };

  const seekRelative = async (offsetMillis: number) => {
    try {
      if (soundRef.current) {
        const newPos = Math.max(
          0,
          Math.min(
            playbackState.positionMillis + offsetMillis,
            playbackState.durationMillis
          )
        );
        await soundRef.current.setPositionAsync(newPos);
      }
    } catch (err) {
      // Ignored
    }
  };

  const seekForward10s = () => seekRelative(10000);
  const seekBackward10s = () => seekRelative(-10000);

  return {
    ...playbackState,
    play,
    pause,
    togglePlayPause,
    seekTo,
    seekForward10s,
    seekBackward10s,
  };
}
