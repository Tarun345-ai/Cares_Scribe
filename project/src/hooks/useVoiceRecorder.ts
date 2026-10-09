import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'processing';

export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/wav';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
      };

      recorder.onerror = (e) => {
        console.error('[Recorder] Error:', e);
        setError('Recording error occurred');
        cleanup();
        setStatus('idle');
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      console.log('[Recorder] Recording started with mimeType:', mimeType);
    } catch (err) {
      console.error('[Recorder] Failed to start:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
      setStatus('idle');
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        cleanup();
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('[Recorder] Recording stopped. Blob size:', blob.size, 'type:', blob.type);
        resolve(blob);
      };

      recorder.stop();
    });
  }, [cleanup]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setRecordingTime(0);
    chunksRef.current = [];
  }, []);

  return {
    status,
    error,
    recordingTime,
    startRecording,
    stopRecording,
    setStatus,
    setError,
    reset,
  };
}
