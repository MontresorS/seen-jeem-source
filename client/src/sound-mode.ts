import { CATEGORIES } from "./data/questions";

const sounds = [
  ["صوت صفارة الشرطة", "11325622-police-siren-sound-effect-240674.mp3"],
  ["هتاف جمهور مباراة كرة القدم", "arunangshubanerjee-live-football-match-stadium-crowd-cheering-563439.mp3"],
  ["خطوات روبوت", "audiopapkin-big-robot-footstep-020-500843.mp3"],
  ["نهيق الحمار", "bluegraya10-donkey-braying-506204.mp3"],
  ["صوت المطر", "boons_freak-rain-sound-188158.mp3"],
  ["مشي عنكبوت كبير", "dragon-studio-giant-spider-walking-511319.mp3"],
  ["نبض القلب", "dragon-studio-heartbeat-sound-372448.mp3"],
  ["صوت فتح الباب", "dragon-studio-open-door-stock-sfx-454246.mp3"],
  ["صوت باب يفتح", "dragon-studio-opening-door-450444.mp3"],
  ["الكتابة على لوحة المفاتيح", "dragon-studio-typing-keyboard-asmr-356116.mp3"],
  ["صوت صرصور الليل", "felix_quinol-cricket-sound-113945.mp3"],
  ["صوت البطة", "freesound_community-075176_duck-quack-40345.mp3"],
  ["مواء القطة", "freesound_community-cat-98721.mp3"],
  ["خطوات على الأرض", "freesound_community-concrete-footsteps-1-6265.mp3"],
  ["صوت الفيل", "freesound_community-elephant-trumpets-growls-6047.mp3"],
  ["صوت آلة كاتبة", "freesound_community-typewriter-typing-68696.mp3"],
  ["صوت الماعز", "freesounds123-goat-sound-403453.mp3"],
  ["صوت الكاميرا", "irinairinafomicheva-camera-13695.mp3"],
  ["رنين الهاتف", "liecio-classic-90x27s-ring-telefone-132277.mp3"],
  ["صوت رسالة آيفون", "son_duquotidient-message-envoye-iphone-apple-391098.mp3"],
  ["صوت لكمة", "soraatwod-punch-416719.mp3"],
  ["فرقعة الأصابع", "soundreality-finger-snap-reverb-423222.mp3"],
  ["زئير الأسد", "soundzee-lion-snarl-growl-354324.mp3"],
  ["صياح الديك", "stefan_grace-rooster-233738.mp3"],
  ["صوت القرد", "stu9-monkey-352770.mp3"],
  ["طلقة نارية", "u_62htdrvg4y-gun-shot-359196.mp3"],
  ["صوت الرعد", "u_q2hb2391vb-thunder-clap-521194.mp3"],
  ["خطوات الحصان", "universfield-horse-walking-123782.mp3"],
  ["نقرة الماوس", "universfield-mouse-click-351398.mp3"],
  ["ثغاء الخروف", "universfield-sheep-bleat-122256.mp3"],
] as const;

const soundCategory = CATEGORIES.find((category) => category.key === "sounds");
const tracks = new Map(sounds);

if (soundCategory) {
  soundCategory.questions.forEach((question, index) => {
    const [answer] = sounds[index % sounds.length];
    question.q = "خمن الصوت ده إيه؟";
    question.a = answer;
  });
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  let currentAudio: HTMLAudioElement | null = null;
  window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
    const answer = utterance.text.replace(/^صوت\s+/, "").trim();
    const filename = tracks.get(answer);
    if (!filename) return;
    currentAudio?.pause();
    currentAudio = new Audio(`/${filename}`);
    currentAudio.play().catch(() => undefined);
  };
}
