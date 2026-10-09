import { useEffect, useRef } from 'react';
import { Loader2, Mic, Square, ArrowUp, AlertCircle, Activity } from 'lucide-react';
import type { RecordingStatus } from '@/hooks/useVoiceRecorder';

interface RecordButtonProps {
  status: RecordingStatus;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({ status, onStart, onStop }: RecordButtonProps) {
  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isIdle = status === 'idle';

  const handleClick = () => {
    if (isProcessing) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-error-400 animate-pulse-ring" />
            <span className="absolute inset-0 rounded-full bg-error-300 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
          </>
        )}
        <button
          onClick={handleClick}
          disabled={isProcessing}
          className={[
            'relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 shadow-lg',
            isIdle && 'bg-error-500 hover:bg-error-600 hover:scale-105 shadow-error-500/30',
            isRecording && 'bg-error-500 hover:bg-error-600 shadow-error-500/40 scale-105',
            isProcessing && 'bg-secondary-400 cursor-not-allowed shadow-secondary-400/20',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isIdle && <Mic className="h-9 w-9 text-white" />}
          {isRecording && <Square className="h-8 w-8 text-white fill-white" />}
          {isProcessing && <Loader2 className="h-8 w-8 text-white animate-spin-slow" />}
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {isIdle && (
          <span className="text-secondary-600">Tap to start recording</span>
        )}
        {isRecording && (
          <span className="flex items-center gap-1.5 text-error-600">
            <span className="h-2 w-2 rounded-full bg-error-500 animate-pulse" />
            Recording...
          </span>
        )}
        {isProcessing && (
          <span className="flex items-center gap-1.5 text-primary-600">
            <Activity className="h-4 w-4" />
            Processing audio...
          </span>
        )}
      </div>

      {isIdle && (
        <p className="flex items-center gap-1.5 text-xs text-secondary-400">
          <ArrowUp className="h-3 w-3" />
          Speak naturally in any language
        </p>
      )}
    </div>
  );
}

interface ProcessingStepProps {
  step: string;
  isDone: boolean;
  isActive: boolean;
}

export function ProcessingStep({ step, isDone, isActive }: ProcessingStepProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex h-6 w-6 items-center justify-center flex-shrink-0">
        {isDone ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isActive ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-secondary-300" />
        )}
      </div>
      <span className={`text-sm ${isDone ? 'text-secondary-700' : isActive ? 'text-primary-700 font-medium' : 'text-secondary-400'}`}>
        {step}
      </span>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 animate-fade-in">
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-error-500 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-error-700">Something went wrong</p>
        <p className="text-sm text-error-600 mt-0.5">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-error-400 hover:text-error-600 transition-colors text-sm font-medium"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label, className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
      {label && <span className="text-sm text-secondary-600">{label}</span>}
    </div>
  );
}
