const soundQuestionIdToFile: Record<string, string> = {
  "sounds-1": "/11325622-police-siren-sound-effect-240674.mp3",
  "sounds-2": "/arunangshubanerjee-live-football-match-stadium-crowd-cheering-563439.mp3",
  "sounds-3": "/audiopapkin-big-robot-footstep-020-500843.mp3",
  "sounds-4": "/bluegraya10-donkey-braying-506204.mp3",
  "sounds-5": "/boons_freak-rain-sound-188158.mp3",
  "sounds-6": "/dragon-studio-giant-spider-walking-511319.mp3",
  "sounds-7": "/dragon-studio-heartbeat-sound-372448.mp3",
  "sounds-8": "/dragon-studio-open-door-stock-sfx-454246.mp3",
  "sounds-9": "/dragon-studio-opening-door-450444.mp3",
  "sounds-10": "/dragon-studio-typing-keyboard-asmr-356116.mp3",
  "sounds-11": "/felix_quinol-cricket-sound-113945.mp3",
  "sounds-12": "/freesound_community-075176_duck-quack-40345.mp3",
  "sounds-13": "/freesound_community-cat-98721.mp3",
  "sounds-14": "/freesound_community-concrete-footsteps-1-6265.mp3",
  "sounds-15": "/freesound_community-elephant-trumpets-growls-6047.mp3",
  "sounds-16": "/freesound_community-typewriter-typing-68696.mp3",
  "sounds-17": "/freesounds123-goat-sound-403453.mp3",
  "sounds-18": "/irinairinafomicheva-camera-13695.mp3",
  "sounds-19": "/liecio-classic-90x27s-ring-telefone-132277.mp3",
  "sounds-20": "/son_duquotidient-message-envoye-iphone-apple-391098.mp3",
  "sounds-21": "/soraatwod-punch-416719.mp3",
  "sounds-22": "/soundreality-finger-snap-reverb-423222.mp3",
  "sounds-23": "/soundzee-lion-snarl-growl-354324.mp3",
  "sounds-24": "/stefan_grace-rooster-233738.mp3",
  "sounds-25": "/stu9-monkey-352770.mp3",
  "sounds-26": "/u_62htdrvg4y-gun-shot-359196.mp3",
  "sounds-27": "/u_q2hb2391vb-thunder-clap-521194.mp3",
  "sounds-28": "/universfield-horse-walking-123782.mp3",
  "sounds-29": "/universfield-mouse-click-351398.mp3",
  "sounds-30": "/universfield-sheep-bleat-122256.mp3",
};

let currentAudio: HTMLAudioElement | null = null;

export function stopCurrentSound(): void {
  currentAudio?.pause();
  currentAudio = null;
}

export function playSoundQuestion(questionId: string): void {
  const filePath = soundQuestionIdToFile[questionId];
  if (!filePath) {
    stopCurrentSound();
    return;
  }

  stopCurrentSound();

  if (typeof document === "undefined") {
    return;
  }

  const audio = document.createElement("audio");
  audio.src = filePath;
  audio.preload = "auto";
  currentAudio = audio;
  void audio.play().catch(() => {
    currentAudio = null;
  });
}

export function playSoundForQuestionId(questionId: string): boolean {
  playSoundQuestion(questionId);
  return Boolean(soundQuestionIdToFile[questionId]);
}

if (typeof window !== "undefined") {
  const nativePushState = window.history.pushState;
  const nativeReplaceState = window.history.replaceState;

  window.history.pushState = function (...args) {
    stopCurrentSound();
    return nativePushState.apply(this, args);
  };

  window.history.replaceState = function (...args) {
    stopCurrentSound();
    return nativeReplaceState.apply(this, args);
  };

  window.addEventListener("popstate", stopCurrentSound);
  window.addEventListener("pagehide", stopCurrentSound);
}
  const nativePushState = window.history.pushState;
  const nativeReplaceState = window.history.replaceState;

  window.history.pushState = function (...args) {
    stopCurrentSound();
    return nativePushState.apply(this, args);
  };

  window.history.replaceState = function (...args) {
    stopCurrentSound();
    return nativeReplaceState.apply(this, args);
  };

  window.addEventListener("popstate", stopCurrentSound);
  window.addEventListener("pagehide", stopCurrentSound);
}
