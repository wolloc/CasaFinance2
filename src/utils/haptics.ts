// iOS Tactile & Haptic Feedback Simulation Utility

export type HapticType = 'selection' | 'impact-light' | 'impact-medium' | 'impact-heavy' | 'success' | 'warning' | 'error';

export const triggerHaptic = (type: HapticType = 'selection') => {
  if (typeof window === 'undefined') return;

  // 1. Web Vibration API if supported (Android / supported mobile webview)
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'selection':
          navigator.vibrate(10);
          break;
        case 'impact-light':
          navigator.vibrate(15);
          break;
        case 'impact-medium':
          navigator.vibrate(25);
          break;
        case 'impact-heavy':
          navigator.vibrate([35, 10, 35]);
          break;
        case 'success':
          navigator.vibrate([15, 50, 25]);
          break;
        case 'warning':
          navigator.vibrate([30, 40, 30]);
          break;
        case 'error':
          navigator.vibrate([50, 40, 50, 40, 50]);
          break;
      }
    } catch {
      // Ignore vibration errors
    }
  }

  // 2. Web Audio API synthesized soft tactile click for iOS Safari / desktop feedback
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'selection' || type === 'impact-light') {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.02);
      }
    }
  } catch {
    // Audio feedback is best-effort
  }
};
