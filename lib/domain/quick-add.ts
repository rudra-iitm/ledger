import { CATEGORIES, type Category } from "./types";

export interface ParsedQuickAdd {
  description: string;
  amount: number;
  category: Category;
}

const CATEGORY_KEYWORDS: Record<string, Category> = {
  lunch: "Food",
  dinner: "Food",
  breakfast: "Food",
  snacks: "Food",
  snack: "Food",
  coffee: "Food",
  tea: "Food",
  chai: "Food",
  groceries: "Food",
  grocery: "Food",
  swiggy: "Food",
  zomato: "Food",
  pizza: "Food",
  burger: "Food",
  biryani: "Food",
  restaurant: "Food",
  food: "Food",
  uber: "Travel",
  ola: "Travel",
  rapido: "Travel",
  cab: "Travel",
  taxi: "Travel",
  auto: "Travel",
  bus: "Travel",
  train: "Travel",
  flight: "Travel",
  metro: "Travel",
  fuel: "Travel",
  petrol: "Travel",
  diesel: "Travel",
  parking: "Travel",
  travel: "Travel",
  amazon: "Shopping",
  flipkart: "Shopping",
  myntra: "Shopping",
  clothes: "Shopping",
  shoes: "Shopping",
  shopping: "Shopping",
  netflix: "Bills",
  spotify: "Bills",
  prime: "Bills",
  hotstar: "Bills",
  youtube: "Bills",
  rent: "Bills",
  electricity: "Bills",
  internet: "Bills",
  wifi: "Bills",
  broadband: "Bills",
  recharge: "Bills",
  phone: "Bills",
  mobile: "Bills",
  bill: "Bills",
  bills: "Bills",
  subscription: "Bills",
  medicine: "Health",
  medicines: "Health",
  doctor: "Health",
  hospital: "Health",
  pharmacy: "Health",
  gym: "Health",
  health: "Health",
  course: "Education",
  books: "Education",
  book: "Education",
  udemy: "Education",
  tuition: "Education",
  college: "Education",
  education: "Education",
};

const CATEGORY_BY_TAG = new Map<string, Category>(
  CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

export function inferCategory(description: string): Category {
  for (const word of description.toLowerCase().split(/\s+/)) {
    const match = CATEGORY_KEYWORDS[word];
    if (match) return match;
  }
  return "Other";
}

export function parseQuickAdd(input: string): ParsedQuickAdd | null {
  let text = input.trim();
  if (!text) return null;

  let explicitCategory: Category | undefined;
  text = text
    .replace(/#(\w+)/g, (whole, tag: string) => {
      const category = CATEGORY_BY_TAG.get(tag.toLowerCase());
      if (category) {
        explicitCategory = category;
        return "";
      }
      return whole;
    })
    .trim();

  const amountMatch = text.match(
    /(?:^|\s)(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*$/i,
  );
  const leadingMatch = text.match(
    /^(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)(?:\s+|$)/i,
  );

  let amount: number | null = null;
  let description = "";

  if (amountMatch) {
    amount = Number(amountMatch[1].replace(/,/g, ""));
    description = text.slice(0, text.length - amountMatch[0].length).trim();
  } else if (leadingMatch) {
    amount = Number(leadingMatch[1].replace(/,/g, ""));
    description = text.slice(leadingMatch[0].length).trim();
  }

  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
  if (!description) return null;

  return {
    description,
    amount,
    category: explicitCategory ?? inferCategory(description),
  };
}
