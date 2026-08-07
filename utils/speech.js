import { speakWithMeSpeak, stopMeSpeak } from './mespeak';

export function speakText(text, onEnd) {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  stopMeSpeak();

  if ('speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0) {
    const utterance = new SpeechSynthesisUtterance(text);
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    window.speechSynthesis.speak(utterance);
  } else {
    speakWithMeSpeak(text, onEnd).catch(onEnd);
  }
}
