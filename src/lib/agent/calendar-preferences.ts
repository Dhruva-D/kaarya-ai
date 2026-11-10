import type { CalendarAction } from "./plan";
import type { SpeechLanguage } from "@/lib/integrations/gnani/tts";

const emailPattern = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/giu;
const noGuests = /\b(?:no guests?|without guests?|do not invite|don't invite|invite no one)\b|किसी को.*(?:नहीं|मत)|कोई.*अतिथि नहीं|ಯಾರನ್ನೂ.*(?:ಬೇಡ|ಆಹ್ವಾನಿಸಬೇಡಿ)|ಅತಿಥಿಗಳು ಬೇಡ|விருந்தினர் வேண்டாம்|అతిథులు వద్దు|അതിഥികൾ വേണ്ട|पाहुणे नको|অতিথি চাই না|મહેમાનો નહીં|ਮਹਿਮਾਨ ਨਹੀਂ/iu;
const noMeet = /\b(?:no (?:google )?meet|without (?:google )?meet|do not add (?:a )?(?:google )?meet)\b|मीट.*(?:नहीं|मत)|ಮೀಟ್.*ಬೇಡ|மீட்.*வேண்டாம்|మీట్.*వద్దు|മീറ്റ്.*വേണ്ട|मीट.*नको|মিট.*চাই না|મીટ.*નહીં|ਮੀਟ.*ਨਹੀਂ/iu;
const yesMeet = /\b(?:add|create|include|with|want|need)\b.{0,24}\b(?:google )?meet\b|\bmeet link\b|मिलने.*लिंक|मीट लिंक|ಮೀಟ್ ಲಿಂಕ್|மீட் இணைப்பு|మీట్ లింక్|മീറ്റ് ലിങ്ക്|মিট লিংক|મીટ લિંક|ਮੀਟ ਲਿੰਕ/iu;

const questions: Record<SpeechLanguage, string> = {
  "bn-IN": "কাউকে আমন্ত্রণ জানাব? Google Meet লিংক যোগ করব? না চাইলে 'কোনো অতিথি নয়, Meet নয়' বলুন।",
  "en-IN": "Should I invite anyone? Please give their email address, or say 'no guests'. Should I add a Google Meet link?",
  "gu-IN": "કોઈને આમંત્રિત કરવું છે? હોય તો ઇમેઇલ આપો, નહીંતર 'મહેમાનો નહીં' કહો. Google Meet લિંક ઉમેરવી છે?",
  "hi-IN": "क्या किसी को बुलाना है? उनका ईमेल बताएं या 'कोई अतिथि नहीं' कहें। Google Meet लिंक जोड़ना है?",
  "kn-IN": "ಯಾರನ್ನಾದರೂ ಆಹ್ವಾನಿಸಬೇಕೇ? ಅವರ ಇಮೇಲ್ ನೀಡಿ ಅಥವಾ 'ಅತಿಥಿಗಳು ಬೇಡ' ಎಂದು ಹೇಳಿ. Google Meet ಲಿಂಕ್ ಸೇರಿಸಬೇಕೇ?",
  "ml-IN": "ആരെയെങ്കിലും ക്ഷണിക്കണോ? ഇമെയിൽ നൽകുക, അല്ലെങ്കിൽ 'അതിഥികൾ വേണ്ട' എന്ന് പറയുക. Google Meet ലിങ്ക് വേണോ?",
  "mr-IN": "कोणाला आमंत्रित करायचे आहे का? ईमेल द्या किंवा 'पाहुणे नको' म्हणा. Google Meet लिंक हवी का?",
  "pa-IN": "ਕਿਸੇ ਨੂੰ ਸੱਦਣਾ ਹੈ? ਈਮੇਲ ਦਿਓ ਜਾਂ 'ਮਹਿਮਾਨ ਨਹੀਂ' ਕਹੋ। Google Meet ਲਿੰਕ ਜੋੜੀਏ?",
  "ta-IN": "யாரையாவது அழைக்க வேண்டுமா? மின்னஞ்சலைக் கொடுங்கள் அல்லது 'விருந்தினர் வேண்டாம்' என்று சொல்லுங்கள். Google Meet இணைப்பு வேண்டுமா?",
  "te-IN": "ఎవరినైనా ఆహ్వానించాలా? ఇమెయిల్ ఇవ్వండి లేదా 'అతిథులు వద్దు' అని చెప్పండి. Google Meet లింక్ కావాలా?",
};

/** Requires an explicit guest and Meet decision, and rejects a proposal that reverses either choice. */
export function calendarPreferencesNeedConfirmation(userTurns: string[], action: CalendarAction): boolean {
  let guestChoice: { emails: string[] } | null = null;
  let meetChoice: boolean | null = null;
  for (const turn of userTurns) {
    const emails = [...turn.matchAll(emailPattern)].map((match) => match[0].toLowerCase());
    if (noGuests.test(turn)) guestChoice = { emails: [] };
    else if (emails.length) guestChoice = { emails };
    if (noMeet.test(turn)) meetChoice = false;
    else if (yesMeet.test(turn)) meetChoice = true;
  }
  if (!guestChoice || meetChoice === null) return true;
  const proposed = (action.args.attendees ?? []).map((email) => email.toLowerCase());
  if (proposed.length !== guestChoice.emails.length || proposed.some((email) => !guestChoice.emails.includes(email))) return true;
  return Boolean(action.args.addMeet) !== meetChoice;
}

export function calendarPreferenceQuestion(language: SpeechLanguage = "en-IN"): string {
  return questions[language];
}
