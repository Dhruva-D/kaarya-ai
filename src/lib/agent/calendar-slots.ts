import type { SpeechLanguage } from "@/lib/integrations/gnani/tts";

const durationUnits = /\b(?:minute|min|hour|hr)s?\b|मिनट|घंटा|घंटे|ನಿಮಿಷ|ಗಂಟೆಗಳ\s*ಕಾಲ|நிமிட|மணி\s*நேரம்|నిమిష|గంటల\s*పాటు|മിനിറ്റ്|മണിക്കൂർ|मिनिट|तास|মিনিট|ঘণ্টা|મિનિટ|કલાક|ਮਿੰਟ|ਘੰਟੇ/iu;
const explicitTimeRange = /\b(?:from\s+)?\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:to|until|[-–])\s*\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?\b/iu;
const genericTitles = new Set(["meeting", "a meeting", "event", "appointment", "ಮೀಟಿಂಗ್", "ಸಭೆ", "मीटिंग", "बैठक"]);

const titleQuestion: Record<SpeechLanguage, string> = {
  "bn-IN": "ইভেন্টের নাম কী হবে?", "en-IN": "What should I call the event?", "gu-IN": "ઇવેન્ટનું નામ શું રાખું?",
  "hi-IN": "इवेंट का नाम क्या रखें?", "kn-IN": "ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ಯಾವ ಹೆಸರಿಡಲಿ?", "ml-IN": "ഇവന്റിന് എന്ത് പേരിടണം?",
  "mr-IN": "इव्हेंटला कोणते नाव द्यायचे?", "pa-IN": "ਇਵੈਂਟ ਦਾ ਕੀ ਨਾਮ ਰੱਖੀਏ?", "ta-IN": "நிகழ்வுக்கு என்ன பெயர் வைக்கலாம்?",
  "te-IN": "ఈవెంట్‌కు ఏ పేరు పెట్టాలి?",
};
const durationQuestion: Record<SpeechLanguage, string> = {
  "bn-IN": "কতক্ষণ চলবে? যেমন, ৩০ মিনিট।", "en-IN": "How long should it last? For example, 30 minutes.", "gu-IN": "તે કેટલો સમય ચાલશે? ઉદાહરણ તરીકે, ૩૦ મિનિટ.",
  "hi-IN": "यह कितनी देर चलेगा? उदाहरण के लिए, 30 मिनट।", "kn-IN": "ಇದು ಎಷ್ಟು ಹೊತ್ತು ನಡೆಯಬೇಕು? ಉದಾಹರಣೆಗೆ, 30 ನಿಮಿಷಗಳು.", "ml-IN": "എത്ര നേരം വേണം? ഉദാഹരണത്തിന്, 30 മിനിറ്റ്.",
  "mr-IN": "किती वेळ चालेल? उदाहरणार्थ, 30 मिनिटे.", "pa-IN": "ਇਹ ਕਿੰਨਾ ਸਮਾਂ ਚੱਲੇਗਾ? ਉਦਾਹਰਨ ਲਈ, 30 ਮਿੰਟ।", "ta-IN": "எவ்வளவு நேரம் நீடிக்க வேண்டும்? எடுத்துக்காட்டாக, 30 நிமிடங்கள்.",
  "te-IN": "ఎంతసేపు ఉండాలి? ఉదాహరణకు, 30 నిమిషాలు.",
};

/** Fail closed when the proposed title or duration has no support in the user's words. */
export function missingCalendarDetails(userTurns: string[], proposedTitle: string): Array<"title" | "duration"> {
  const spoken = userTurns.join(" ").normalize("NFKC").toLocaleLowerCase();
  const title = proposedTitle.trim().normalize("NFKC").toLocaleLowerCase();
  const missing: Array<"title" | "duration"> = [];
  if (!title || genericTitles.has(title) || !spoken.includes(title)) missing.push("title");
  if (!durationUnits.test(spoken) && !explicitTimeRange.test(spoken)) missing.push("duration");
  return missing;
}

export function calendarDetailQuestion(missing: Array<"title" | "duration">, language: SpeechLanguage = "en-IN"): string {
  return missing.map((field) => field === "title" ? titleQuestion[language] : durationQuestion[language]).join(" ");
}
