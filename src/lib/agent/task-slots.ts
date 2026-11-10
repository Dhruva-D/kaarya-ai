import type { TaskAction } from "./plan";
import type { SpeechLanguage } from "@/lib/integrations/gnani/tts";

const timeExpression = /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:at|around)\s+\d{1,2}(?::\d{2})?\b|\d+\s*(?:बजे|ಗಂಟೆಗೆ|மணிக்கு|గంటలకు|മണിക്ക്|वाजता|টায়|વાગ્યે|ਵਜੇ)/iu;
const dateOnlyConsent = /\b(?:date[- ]only|without (?:a )?reminder|no (?:timed )?alarm)\b|केवल तारीख|सिर्फ तारीख|ದಿನಾಂಕ ಮಾತ್ರ|தேதி மட்டும்|తేదీ మాత్రమే|തീയതി മാത്രം|फक्त तारीख|শুধু তারিখ|ફક્ત તારીખ|ਸਿਰਫ਼ ਮਿਤੀ/iu;
const genericTitles = new Set(["task", "a task", "reminder", "काम", "ಕಾರ್ಯ"]);

const titleQuestions: Record<SpeechLanguage, string> = {
  "bn-IN": "টাস্কের নাম কী হবে?", "en-IN": "What should I call the task?", "gu-IN": "ટાસ્કનું નામ શું રાખું?",
  "hi-IN": "टास्क का नाम क्या रखें?", "kn-IN": "ಕಾರ್ಯಕ್ಕೆ ಯಾವ ಹೆಸರಿಡಲಿ?", "ml-IN": "ടാസ്കിന് എന്ത് പേരിടണം?",
  "mr-IN": "टास्कला कोणते नाव द्यायचे?", "pa-IN": "ਟਾਸਕ ਦਾ ਕੀ ਨਾਮ ਰੱਖੀਏ?", "ta-IN": "பணிக்கு என்ன பெயர் வைக்கலாம்?",
  "te-IN": "టాస్క్‌కు ఏ పేరు పెట్టాలి?",
};
const timeQuestions: Record<SpeechLanguage, string> = {
  "bn-IN": "Google Tasks শুধু তারিখ সংরক্ষণ করে, সময়ের অ্যালার্ম নয়। শুধু তারিখ দিয়ে টাস্ক তৈরি করব?",
  "en-IN": "Google Tasks saves a date, not a timed alert. Should I create this as a date-only task?",
  "gu-IN": "Google Tasks માત્ર તારીખ સાચવે છે, સમયનું એલાર્મ નહીં. માત્ર તારીખ સાથે ટાસ્ક બનાવું?",
  "hi-IN": "Google Tasks सिर्फ तारीख सेव करता है, समय का अलार्म नहीं। क्या इसे केवल तारीख वाले टास्क के रूप में बनाऊँ?",
  "kn-IN": "Google Tasks ದಿನಾಂಕವನ್ನು ಮಾತ್ರ ಉಳಿಸುತ್ತದೆ, ಸಮಯದ ಅಲಾರಂ ಅಲ್ಲ. ಇದನ್ನು ದಿನಾಂಕ ಮಾತ್ರ ಇರುವ ಕಾರ್ಯವಾಗಿ ರಚಿಸಬೇಕೇ?",
  "ml-IN": "Google Tasks തീയതി മാത്രമേ സൂക്ഷിക്കൂ, സമയ അലാറമല്ല. തീയതി മാത്രം ഉള്ള ടാസ്ക് സൃഷ്ടിക്കണോ?",
  "mr-IN": "Google Tasks फक्त तारीख साठवते, वेळेचा अलार्म नाही. फक्त तारखेचा टास्क तयार करू?",
  "pa-IN": "Google Tasks ਸਿਰਫ਼ ਮਿਤੀ ਸੰਭਾਲਦਾ ਹੈ, ਸਮੇਂ ਦਾ ਅਲਾਰਮ ਨਹੀਂ। ਸਿਰਫ਼ ਮਿਤੀ ਵਾਲਾ ਟਾਸਕ ਬਣਾਈਏ?",
  "ta-IN": "Google Tasks தேதியை மட்டுமே சேமிக்கும்; நேர அலாரம் இல்லை. தேதி மட்டும் உள்ள பணியை உருவாக்கலாமா?",
  "te-IN": "Google Tasks తేదీని మాత్రమే సేవ్ చేస్తుంది, సమయ అలారం కాదు. తేదీ మాత్రమే ఉన్న టాస్క్‌ను సృష్టించాలా?",
};

export function missingTaskDetails(userTurns: string[], action: TaskAction): Array<"title" | "timed"> {
  const source = userTurns.join(" ").normalize("NFKC").toLocaleLowerCase();
  const title = action.args.title.trim().normalize("NFKC").toLocaleLowerCase();
  const missing: Array<"title" | "timed"> = [];
  if (!title || genericTitles.has(title) || !source.includes(title)) missing.push("title");
  const taskSegments = userTurns.map((turn) => {
    const taskMarker = /\b(?:task|remind(?:er)?)\b/giu;
    const positions = [...turn.matchAll(taskMarker)];
    const scoped = positions.length ? turn.slice(positions.at(-1)!.index) : turn;
    return scoped.split(/\b(?:calendar|event|meeting)\b/iu, 1)[0];
  });
  if (taskSegments.some((turn) => timeExpression.test(turn)) && !userTurns.some((turn) => dateOnlyConsent.test(turn))) missing.push("timed");
  return missing;
}

export function taskDetailQuestion(missing: Array<"title" | "timed">, language: SpeechLanguage = "en-IN"): string {
  return missing.map((field) => field === "title" ? titleQuestions[language] : timeQuestions[language]).join(" ");
}
