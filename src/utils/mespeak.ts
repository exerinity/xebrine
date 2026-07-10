interface MeSpeakArgs {
  amplitude?: number;
  pitch?: number;
  speed?: number;
  wordgap?: number;
  variant?: string;
  callback?: (success: boolean) => void;
}

interface MeSpeak {
  loadConfig(url: string): void;
  loadVoice(url: string): void;
  speak(text: string, args?: MeSpeakArgs): number;
  stop(): number;
}

const SPEAK_ARGS: MeSpeakArgs = {
  speed: 155,
  pitch: 44,
  wordgap: 2,
  amplitude: 100
};

let meSpeakPromise: Promise<MeSpeak> | null = null;
let resolvedMeSpeak: MeSpeak | null = null;

function loadMeSpeak(): Promise<MeSpeak> {
  if (!meSpeakPromise) {
    meSpeakPromise = import('mespeak').then((mod) => {
      const meSpeak = ((mod as { default?: MeSpeak }).default ?? mod) as unknown as MeSpeak;
      meSpeak.loadConfig('/app/mespeak/mespeak_config.json');
      meSpeak.loadVoice('/app/mespeak/en-us.json');
      resolvedMeSpeak = meSpeak;
      return meSpeak;
    });
  }
  return meSpeakPromise;
}

export async function speakWithMeSpeak(text: string, onEnd?: (success: boolean) => void): Promise<void> {
  const meSpeak = await loadMeSpeak();
  meSpeak.speak(text, { ...SPEAK_ARGS, callback: onEnd });
}

export function stopMeSpeak(): void {
  resolvedMeSpeak?.stop();
}
