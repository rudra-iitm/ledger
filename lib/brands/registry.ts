import type { Category } from "@/lib/domain/types";

export interface Brand {
  id: string;
  name: string;
  aliases: string[];
  category: Category;
  accentColor: string;
  domain?: string;
}

export const BRAND_REGISTRY: Brand[] = [
  { id: "uber", name: "Uber", aliases: ["uber india", "uber trip", "uber.com"], category: "Travel", accentColor: "#FFFFFF", domain: "uber.com" },
  { id: "ola", name: "Ola", aliases: ["ola cabs", "olacabs"], category: "Travel", accentColor: "#D6DF27", domain: "olacabs.com" },
  { id: "rapido", name: "Rapido", aliases: ["rapido bike"], category: "Travel", accentColor: "#F9C51B", domain: "rapido.bike" },
  { id: "indrive", name: "inDrive", aliases: ["indrive"], category: "Travel", accentColor: "#A0D911", domain: "indrive.com" },
  
  { id: "swiggy", name: "Swiggy", aliases: ["swiggy limited", "swiggy instamart", "bundl technologies"], category: "Food", accentColor: "#FC8019", domain: "swiggy.com" },
  { id: "zomato", name: "Zomato", aliases: ["zomato online", "zomato media"], category: "Food", accentColor: "#E23744", domain: "zomato.com" },
  { id: "blinkit", name: "Blinkit", aliases: ["grofers"], category: "Shopping", accentColor: "#F8CB46", domain: "blinkit.com" },
  { id: "zepto", name: "Zepto", aliases: ["kirana kart"], category: "Shopping", accentColor: "#FF3269", domain: "zeptonow.com" },
  { id: "instamart", name: "Instamart", aliases: [], category: "Shopping", accentColor: "#FC8019", domain: "swiggy.com" },

  { id: "amazon", name: "Amazon", aliases: ["amazon seller services", "amazon pay india", "amzn", "amazon.in"], category: "Shopping", accentColor: "#FF9900", domain: "amazon.in" },
  { id: "flipkart", name: "Flipkart", aliases: ["flipkart internet"], category: "Shopping", accentColor: "#2874F0", domain: "flipkart.com" },
  { id: "myntra", name: "Myntra", aliases: ["myntra designs"], category: "Shopping", accentColor: "#FF3F6C", domain: "myntra.com" },
  { id: "ajio", name: "Ajio", aliases: ["reliance retail"], category: "Shopping", accentColor: "#2F4254", domain: "ajio.com" },
  { id: "meesho", name: "Meesho", aliases: ["fashnear technologies"], category: "Shopping", accentColor: "#F43397", domain: "meesho.com" },

  { id: "netflix", name: "Netflix", aliases: ["netflix india", "netflix.com", "netflix premium"], category: "Entertainment", accentColor: "#E50914", domain: "netflix.com" },
  { id: "spotify", name: "Spotify", aliases: ["spotify india", "spotify premium"], category: "Entertainment", accentColor: "#1DB954", domain: "spotify.com" },
  { id: "youtube_premium", name: "YouTube Premium", aliases: ["google youtube", "youtube", "youtube.com"], category: "Entertainment", accentColor: "#FF0000", domain: "youtube.com" },
  { id: "amazon_prime", name: "Amazon Prime Video", aliases: ["prime video", "amazon prime"], category: "Entertainment", accentColor: "#00A8E1", domain: "primevideo.com" },
  { id: "hotstar", name: "Disney+ Hotstar", aliases: ["hotstar", "novi digital", "disney plus hotstar"], category: "Entertainment", accentColor: "#121926", domain: "hotstar.com" },
  { id: "jiohotstar", name: "JioHotstar", aliases: ["jio hotstar"], category: "Entertainment", accentColor: "#0F4594", domain: "hotstar.com" },
  { id: "sonyliv", name: "Sony LIV", aliases: ["sonyliv", "sony pictures networks"], category: "Entertainment", accentColor: "#E01A22", domain: "sonyliv.com" },
  { id: "apple_tv", name: "Apple TV+", aliases: ["apple tv", "apple.com/bill", "apple services"], category: "Entertainment", accentColor: "#FFFFFF", domain: "tv.apple.com" },

  { id: "google_pay", name: "Google Pay", aliases: ["gpay", "google india digital"], category: "Other", accentColor: "#4285F4", domain: "pay.google.com" },
  { id: "phonepe", name: "PhonePe", aliases: ["phonepe private"], category: "Other", accentColor: "#5F259F", domain: "phonepe.com" },
  { id: "paytm", name: "Paytm", aliases: ["one97 communications"], category: "Other", accentColor: "#00B9F1", domain: "paytm.com" },
  { id: "cred", name: "CRED", aliases: ["dreamplug technologies"], category: "Other", accentColor: "#FFFFFF", domain: "cred.club" },
  { id: "bhim", name: "BHIM", aliases: ["npci bhim"], category: "Other", accentColor: "#F47B20", domain: "bhimupi.org.in" },

  { id: "airbnb", name: "Airbnb", aliases: ["airbnb inc"], category: "Travel", accentColor: "#FF5A5F", domain: "airbnb.com" },
  { id: "booking", name: "Booking.com", aliases: ["booking com"], category: "Travel", accentColor: "#003580", domain: "booking.com" },
  { id: "makemytrip", name: "MakeMyTrip", aliases: ["mmt"], category: "Travel", accentColor: "#D92E31", domain: "makemytrip.com" },
  { id: "goibibo", name: "Goibibo", aliases: ["ibibo group"], category: "Travel", accentColor: "#FF6D38", domain: "goibibo.com" },

  { id: "chatgpt", name: "ChatGPT", aliases: ["openai", "chatgpt plus"], category: "Other", accentColor: "#10A37F", domain: "openai.com" },
  { id: "claude", name: "Claude", aliases: ["anthropic"], category: "Other", accentColor: "#D97757", domain: "anthropic.com" },
  { id: "github", name: "GitHub", aliases: ["github inc"], category: "Other", accentColor: "#FFFFFF", domain: "github.com" },
  { id: "figma", name: "Figma", aliases: ["figma inc"], category: "Other", accentColor: "#F24E1E", domain: "figma.com" },
  { id: "notion", name: "Notion", aliases: ["notion labs"], category: "Other", accentColor: "#FFFFFF", domain: "notion.so" },
  { id: "canva", name: "Canva", aliases: ["canva pty"], category: "Other", accentColor: "#00C4CC", domain: "canva.com" },
  { id: "cursor", name: "Cursor", aliases: ["anysphere"], category: "Other", accentColor: "#FFFFFF", domain: "cursor.com" },
  { id: "linear", name: "Linear", aliases: ["linearorbit"], category: "Other", accentColor: "#5E6AD2", domain: "linear.app" },

  { id: "whatsapp", name: "WhatsApp", aliases: ["whatsapp inc"], category: "Other", accentColor: "#25D366", domain: "whatsapp.com" },
  { id: "telegram", name: "Telegram", aliases: ["telegram messenger"], category: "Other", accentColor: "#229ED9", domain: "telegram.org" },
  { id: "discord", name: "Discord", aliases: ["discord inc"], category: "Other", accentColor: "#5865F2", domain: "discord.com" },
  { id: "slack", name: "Slack", aliases: ["slack technologies"], category: "Other", accentColor: "#E01E5A", domain: "slack.com" },
  { id: "zoom", name: "Zoom", aliases: ["zoom video"], category: "Other", accentColor: "#2D8CFF", domain: "zoom.us" },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveBrand(text: string): Brand | null {
  if (!text) return null;
  const raw = text.toLowerCase();
  
  let normalizedRaw = raw;
  if (raw.startsWith("upi/")) {
    const parts = raw.split("/");
    if (parts.length > 1) {
      normalizedRaw = parts[1];
    }
  } else if (raw.startsWith("paytm-") || raw.startsWith("phonepe-") || raw.startsWith("gpay-")) {
    const parts = raw.split("-");
    if (parts.length > 1) {
      normalizedRaw = parts[1];
    }
  }
  
  const searchTerms = [raw, normalizedRaw];
  
  for (const term of searchTerms) {
    const normTerm = normalize(term);
    
    for (const brand of BRAND_REGISTRY) {
      if (normalize(brand.name) === normTerm) return brand;
      for (const alias of brand.aliases) {
        if (normalize(alias) === normTerm) return brand;
      }
    }
    
    for (const brand of BRAND_REGISTRY) {
      if (term.includes(brand.name.toLowerCase())) return brand;
      for (const alias of brand.aliases) {
        if (term.includes(alias.toLowerCase())) return brand;
      }
    }
  }
  
  return null;
}
