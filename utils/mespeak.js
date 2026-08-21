const SPEAK_ARGS = {
  speed: 155,
  pitch: 44,
  wordgap: 2,
  amplitude: 100
};

let meSpeakPromise = null;
let resolvedMeSpeak = null;

function loadMeSpeak() {
  if (!meSpeakPromise) {
    meSpeakPromise = import('mespeak').then((mod) => {
      const meSpeak = mod.default ?? mod;
      meSpeak.loadConfig('/app/mespeak/mespeak_config.json');
      meSpeak.loadVoice('/app/mespeak/en_us.json');
      resolvedMeSpeak = meSpeak;
      return meSpeak;
    });
  }
  return meSpeakPromise;
}

export async function speakWithMeSpeak(text, onEnd) {
  const meSpeak = await loadMeSpeak();
  meSpeak.speak(text, { ...SPEAK_ARGS, callback: onEnd });
}

export function stopMeSpeak() {
  resolvedMeSpeak?.stop();
}
