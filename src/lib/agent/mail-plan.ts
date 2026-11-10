import type { MailAction } from "./plan";
import type { SpeechLanguage } from "@/lib/integrations/gnani/tts";

const recipientQuestions: Record<SpeechLanguage, string> = {
  "bn-IN": "কাকে ইমেল পাঠাব? ইমেল ঠিকানাটি দিন।", "en-IN": "What exact email address should I send this to?", "gu-IN": "કયા ઇમેઇલ સરનામે મોકલવું?",
  "hi-IN": "किस ईमेल पते पर भेजना है?", "kn-IN": "ಯಾವ ಇಮೇಲ್ ವಿಳಾಸಕ್ಕೆ ಕಳುಹಿಸಬೇಕು?", "ml-IN": "ഏത് ഇമെയിൽ വിലാസത്തിലേക്ക് അയയ്ക്കണം?",
  "mr-IN": "कोणत्या ईमेल पत्त्यावर पाठवायचे?", "pa-IN": "ਕਿਹੜੇ ਈਮੇਲ ਪਤੇ 'ਤੇ ਭੇਜਣਾ ਹੈ?", "ta-IN": "எந்த மின்னஞ்சல் முகவரிக்கு அனுப்ப வேண்டும்?",
  "te-IN": "ఏ ఇమెయిల్ చిరునామాకు పంపాలి?",
};

export function recipientWasSupplied(action: MailAction, userTurns: string[]): boolean {
  return userTurns.some((turn) => turn.toLowerCase().includes(action.args.to.toLowerCase()));
}

export function recipientQuestion(language: SpeechLanguage = "en-IN"): string {
  return recipientQuestions[language];
}

export function validateMailProposal(action: MailAction, userTurns: string[]): MailAction {
  if (!recipientWasSupplied(action, userTurns)) {
    throw new Error("Recipient email was not supplied by the user");
  }
  return action;
}
