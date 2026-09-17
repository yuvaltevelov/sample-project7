type EmailInput = { from: string; subject: string; snippet: string };
type Priority = "critical" | "high" | "medium" | "low";

export type EmailClassification = {
  relevant: boolean;
  category: string;
  priority: Priority;
  why: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchesTerm = (text: string, term: string) => {
  if (/^[a-z0-9 ]+$/i.test(term)) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:$|[^a-z0-9])`, "i");
    return pattern.test(text);
  }
  return text.includes(term);
};
const includesAny = (text: string, terms: string[]) => terms.some((term) => matchesTerm(text, term));

export function classifyEmail(input: EmailInput): EmailClassification {
  const text = `${input.from} ${input.subject} ${input.snippet}`.toLowerCase();

  if (includesAny(text, ["@pac.ac.il", "peres academic", "מרכז האקדמי פרס", "המרכז האקדמי פרס"])) {
    return { relevant: true, category: "PAC", priority: "high", why: "כל הודעה מ-PAC/המרכז האקדמי פרס מסומנת כחשובה." };
  }

  if (includesAny(text, ["security alert", "suspicious", "new device", "password", "breach", "אבטחה", "כניסה חדשה", "סיסמה", "חשודה"])) {
    return { relevant: true, category: "אבטחה", priority: "critical", why: "אירוע אבטחה או שינוי בחשבון דורש בדיקה מיידית." };
  }

  if (includesAny(text, ["action required", "please reply", "reply required", "deadline", "due by", "submit", "נדרש", "נדרשת", "יש להשלים", "עד לתאריך", "דדליין", "להגיש", "נא להשיב"])) {
    return { relevant: true, category: "דורש פעולה", priority: "high", why: "המייל כולל בקשת פעולה או deadline." };
  }

  if (includesAny(text, ["invoice", "payment", "bill", "bank", "charge", "refund", "receipt", "חשבונית", "תשלום", "חיוב", "בנק", "החזר", "קבלה"])) {
    return { relevant: true, category: "כסף", priority: "high", why: "המייל קשור לכסף, תשלום או מסמך פיננסי שכדאי לבדוק." };
  }

  if (includesAny(text, ["flight", "booking", "reservation", "hotel", "shipment", "delivery", "order status", "טיסה", "הזמנה", "משלוח", "מלון", "איסוף"])) {
    return { relevant: true, category: "נסיעות/הזמנות", priority: "medium", why: "זהו עדכון הזמנה, נסיעה או משלוח עם משמעות תפעולית." };
  }

  if (includesAny(text, ["shift", "schedule", "exam", "classroom", "assignment", "career", "משמרת", "סידור עבודה", "בחינה", "כיתה", "מטלה", "משרה"])) {
    return { relevant: true, category: "עבודה/לימודים", priority: "high", why: "המייל קשור לעבודה או לימודים ועשוי להשפיע על הלו״ז שלך." };
  }

  const tech = includesAny(text, ["ai", "software", "subscription", "cloud", "electronics", "laptop", "phone", "apple", "cursor", "coursera", "טכנולוג", "תוכנה", "מנוי", "אלקטרוניקה", "מחשב"]);
  const discountMatch = text.match(/(?:save\s*)?(\d{2,3})\s*%|(?:עד\s*)?(\d{2,3})\s*%/);
  const discount = Number(discountMatch?.[1] ?? discountMatch?.[2] ?? 0);
  const exceptionalDeal = discount >= 30 || includesAny(text, ["free trial", "free year", "חינם"]);
  if (tech && exceptionalDeal) {
    return { relevant: true, category: "דיל טכנולוגיה", priority: "medium", why: "מבצע טכנולוגיה משמעותי יחסית, לא קידום שגרתי." };
  }

  return { relevant: false, category: "לא חשוב", priority: "low", why: "לא נמצא טריגר שמצדיק התראה." };
}
