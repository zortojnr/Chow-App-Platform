import { DishCategory } from "@prisma/client";

export interface DishSeedEntry {
  canonicalName: string;
  aliases: string[];
  category: DishCategory;
  subcategory?: string;
  description?: string;
}

export const DISHES: DishSeedEntry[] = [
  // ─── RICE DISHES (10) ───────────────────────────────────────
  {
    canonicalName: "Jollof Rice",
    aliases: ["party jollof", "Nigerian jollof"],
    category: DishCategory.RICE_DISHES,
    description: "Smoky tomato-based rice cooked in a single pot, a West African staple.",
  },
  {
    canonicalName: "Fried Rice",
    aliases: ["Nigerian fried rice"],
    category: DishCategory.RICE_DISHES,
    description: "Stir-fried rice with mixed vegetables, liver, and seasoning.",
  },
  {
    canonicalName: "Ofada Rice",
    aliases: ["ofada", "local rice"],
    category: DishCategory.RICE_DISHES,
    subcategory: "Local Varieties",
    description: "Short-grain unpolished Nigerian rice typically served with ayamase stew.",
  },
  {
    canonicalName: "Coconut Rice",
    aliases: ["coconut jollof"],
    category: DishCategory.RICE_DISHES,
    description: "Rice cooked in coconut milk with spices and seafood.",
  },
  {
    canonicalName: "Plain Rice",
    aliases: ["white rice", "steamed rice"],
    category: DishCategory.RICE_DISHES,
    description: "Plain steamed white rice, typically served with stew or sauce.",
  },
  {
    canonicalName: "Tuwo Shinkafa",
    aliases: ["tuwo", "tuwon shinkafa"],
    category: DishCategory.RICE_DISHES,
    subcategory: "Northern",
    description: "Soft mashed rice pudding from Northern Nigeria, served with soups.",
  },
  {
    canonicalName: "Jollof Spaghetti",
    aliases: ["spaghetti jollof", "naija spaghetti"],
    category: DishCategory.RICE_DISHES,
    description: "Spaghetti cooked in tomato-based sauce in the jollof style.",
  },
  {
    canonicalName: "Rice and Stew",
    aliases: ["white rice and stew", "rice and tomato stew"],
    category: DishCategory.RICE_DISHES,
    description: "Plain steamed rice paired with Nigerian tomato stew.",
  },
  {
    canonicalName: "Fried Rice with Chicken",
    aliases: ["chicken fried rice"],
    category: DishCategory.RICE_DISHES,
    description: "Nigerian-style fried rice served with grilled or fried chicken.",
  },
  {
    canonicalName: "Native Rice",
    aliases: ["abacha rice", "ofada stew rice"],
    category: DishCategory.RICE_DISHES,
    subcategory: "Local Varieties",
    description: "Local Nigerian rice varieties cooked in traditional methods.",
  },

  // ─── SOUPS (15) ─────────────────────────────────────────────
  {
    canonicalName: "Egusi Soup",
    aliases: ["egusi", "melon seed soup"],
    category: DishCategory.SOUPS,
    description: "Rich soup made from ground melon seeds, leafy greens, and assorted meats.",
  },
  {
    canonicalName: "Efo Riro",
    aliases: ["efo", "vegetable soup yoruba"],
    category: DishCategory.SOUPS,
    subcategory: "Yoruba",
    description: "Yoruba-style spinach stew cooked with palm oil, assorted meats, and stockfish.",
  },
  {
    canonicalName: "Ogbono Soup",
    aliases: ["ogbono", "draw soup with ogbono", "wild mango seed soup"],
    category: DishCategory.SOUPS,
    description: "Thick, mucilaginous soup made from ground ogbono seeds.",
  },
  {
    canonicalName: "Banga Soup",
    aliases: ["banga", "palm nut soup", "ofe akwu"],
    category: DishCategory.SOUPS,
    subcategory: "Delta/Igbo",
    description: "Rich soup made from palm nut extract, popular in Delta and Igbo cuisine.",
  },
  {
    canonicalName: "Afang Soup",
    aliases: ["afang", "okazi and waterleaf soup"],
    category: DishCategory.SOUPS,
    subcategory: "Cross River/Akwa Ibom",
    description: "Efik-style soup made with afang (okazi) leaves and waterleaf.",
  },
  {
    canonicalName: "Edikang Ikong",
    aliases: ["edikaikong", "edikang ikong soup"],
    category: DishCategory.SOUPS,
    subcategory: "Cross River/Akwa Ibom",
    description: "Efik soup made with waterleaf and fluted pumpkin (ugu), loaded with assorted meats.",
  },
  {
    canonicalName: "Vegetable Soup",
    aliases: ["ofe akwukwo", "ugu soup"],
    category: DishCategory.SOUPS,
    description: "General Nigerian leafy green soup with palm oil and assorted proteins.",
  },
  {
    canonicalName: "Groundnut Soup",
    aliases: ["peanut soup", "miyan gyada"],
    category: DishCategory.SOUPS,
    subcategory: "Northern",
    description: "Creamy peanut-based soup common in Northern Nigeria.",
  },
  {
    canonicalName: "Bitterleaf Soup",
    aliases: ["ofe onugbu", "ofe olufe"],
    category: DishCategory.SOUPS,
    subcategory: "Igbo",
    description: "Igbo soup made with washed bitterleaf, cocoyam, and assorted meats.",
  },
  {
    canonicalName: "Okra Soup",
    aliases: ["okro soup", "ila asepo"],
    category: DishCategory.SOUPS,
    description: "Slimy-textured soup made with sliced or blended okra.",
  },
  {
    canonicalName: "Draw Soup",
    aliases: ["otong soup", "ofe ede"],
    category: DishCategory.SOUPS,
    description: "Sticky textured soup made with a blend of ogbono and okra.",
  },
  {
    canonicalName: "White Soup",
    aliases: ["ofe ocha", "nsala soup", "catfish pepper soup"],
    category: DishCategory.SOUPS,
    subcategory: "Igbo",
    description: "Light, non-palm-oil Igbo soup made with utazi leaves, yam, and catfish.",
  },
  {
    canonicalName: "Oha Soup",
    aliases: ["ora soup", "ofe ora"],
    category: DishCategory.SOUPS,
    subcategory: "Igbo",
    description: "Igbo soup made with oha (ora) leaves and cocoyam thickener.",
  },
  {
    canonicalName: "Ofe Onugbu",
    aliases: ["bitter leaf ofe", "igbo bitter leaf soup"],
    category: DishCategory.SOUPS,
    subcategory: "Igbo",
    description: "Igbo-style bitterleaf soup with ede (cocoyam) and ozu (dried fish).",
  },
  {
    canonicalName: "Miyan Kuka",
    aliases: ["luru soup", "kuka soup"],
    category: DishCategory.SOUPS,
    subcategory: "Northern/Hausa-Fulani",
    description: "Northern Nigerian soup made from baobab leaves, dried meat, and dawadawa.",
  },

  // ─── SWALLOW (6) ────────────────────────────────────────────
  {
    canonicalName: "Pounded Yam",
    aliases: ["iyan", "pounded yam balls"],
    category: DishCategory.SWALLOW,
    description: "Smooth stretchy dough made by pounding boiled yam in a mortar.",
  },
  {
    canonicalName: "Eba",
    aliases: ["garri", "eba balls"],
    category: DishCategory.SWALLOW,
    description: "Stiff dough made by mixing garri (dried cassava) with hot water.",
  },
  {
    canonicalName: "Fufu",
    aliases: ["akpu", "cassava fufu"],
    category: DishCategory.SWALLOW,
    description: "Soft, stretchy dough made from fermented cassava pulp.",
  },
  {
    canonicalName: "Amala",
    aliases: ["amala iyán", "yam flour swallow"],
    category: DishCategory.SWALLOW,
    subcategory: "Yoruba",
    description: "Dark swallow made from dried yam flour, common in Yoruba cuisine.",
  },
  {
    canonicalName: "Semovita",
    aliases: ["semo", "semolina swallow"],
    category: DishCategory.SWALLOW,
    description: "Smooth white swallow made from semolina flour.",
  },
  {
    canonicalName: "Tuwo Masara",
    aliases: ["corn tuwo", "maize swallow"],
    category: DishCategory.SWALLOW,
    subcategory: "Northern",
    description: "Northern Nigerian corn flour swallow, similar to ugali.",
  },

  // ─── PROTEIN / GRILLS (8) ───────────────────────────────────
  {
    canonicalName: "Suya",
    aliases: ["tsire", "beef suya", "chicken suya"],
    category: DishCategory.PROTEIN,
    description: "Spiced, skewered grilled meat coated in suya spice (yaji) blend.",
  },
  {
    canonicalName: "Asun",
    aliases: ["peppered goat meat", "smoked goat"],
    category: DishCategory.PROTEIN,
    subcategory: "Yoruba",
    description: "Smoky, peppered goat meat — a Yoruba party staple.",
  },
  {
    canonicalName: "Peppered Chicken",
    aliases: ["peppered chicken wings", "fried peppered chicken"],
    category: DishCategory.PROTEIN,
    description: "Fried or grilled chicken tossed in a spicy pepper sauce.",
  },
  {
    canonicalName: "Peppersoup",
    aliases: ["pepper soup", "catfish pepper soup", "goat pepper soup"],
    category: DishCategory.PROTEIN,
    description: "Thin, peppery broth with assorted meats or fish and native spices.",
  },
  {
    canonicalName: "Nkwobi",
    aliases: ["nkwobi cow foot", "ukpaka nkwobi"],
    category: DishCategory.PROTEIN,
    subcategory: "Igbo",
    description: "Igbo palm-oil-based cow-foot dish seasoned with ugba (oil bean) and utazi.",
  },
  {
    canonicalName: "Isi Ewu",
    aliases: ["goat head", "isi-ewu"],
    category: DishCategory.PROTEIN,
    subcategory: "Igbo",
    description: "Spiced goat-head delicacy cooked in palm oil and native spices.",
  },
  {
    canonicalName: "Kilishi",
    aliases: ["kelechi", "dried spiced meat"],
    category: DishCategory.PROTEIN,
    subcategory: "Northern",
    description: "Thin sun-dried spiced beef jerky from Northern Nigeria.",
  },
  {
    canonicalName: "Grilled Fish",
    aliases: ["boli and fish", "whole grilled fish", "buka fish"],
    category: DishCategory.PROTEIN,
    description: "Whole fish grilled over open flame with pepper and spice rub.",
  },

  // ─── STREET FOOD / SNACKS (6) ───────────────────────────────
  {
    canonicalName: "Akara",
    aliases: ["bean cake", "bean fritters", "acaraje"],
    category: DishCategory.STREET_FOOD,
    description: "Deep-fried black-eyed pea fritters, commonly eaten as breakfast or snack.",
  },
  {
    canonicalName: "Puff Puff",
    aliases: ["puff-puff", "buns"],
    category: DishCategory.STREET_FOOD,
    description: "Deep-fried yeasted dough balls — a classic Nigerian street snack.",
  },
  {
    canonicalName: "Boli",
    aliases: ["roasted plantain", "bole"],
    category: DishCategory.STREET_FOOD,
    description: "Roasted ripe plantain, commonly served with groundnut or fish.",
  },
  {
    canonicalName: "Roasted Corn",
    aliases: ["oka ina", "barbeque corn"],
    category: DishCategory.STREET_FOOD,
    description: "Maize cobs roasted over charcoal, a popular roadside snack.",
  },
  {
    canonicalName: "Moi Moi",
    aliases: ["moimoi", "bean pudding", "steamed bean cake"],
    category: DishCategory.STREET_FOOD,
    description: "Steamed black-eyed pea pudding with peppers, onions, and fillings.",
  },
  {
    canonicalName: "Gizdodo",
    aliases: ["gizzard dodo", "gizzard and plantain"],
    category: DishCategory.STREET_FOOD,
    description: "Fried plantain and gizzard tossed in a spicy sauce.",
  },

  // ─── BREAKFAST (5) ──────────────────────────────────────────
  {
    canonicalName: "Yam and Egg Sauce",
    aliases: ["fried yam and egg", "yam egg stew"],
    category: DishCategory.BREAKFAST,
    description: "Boiled or fried yam served with Nigerian-style egg sauce.",
  },
  {
    canonicalName: "Beans and Plantain",
    aliases: ["ewa and dodo", "beans and dodo"],
    category: DishCategory.BREAKFAST,
    description: "Cooked beans paired with fried ripe plantain.",
  },
  {
    canonicalName: "Akara and Pap",
    aliases: ["akara and ogi", "bean cake and pap"],
    category: DishCategory.BREAKFAST,
    description: "Bean fritters served alongside warm corn porridge.",
  },
  {
    canonicalName: "Ogi",
    aliases: ["pap", "akamu", "corn porridge"],
    category: DishCategory.BREAKFAST,
    description: "Fermented cereal porridge made from corn, millet, or sorghum.",
  },
  {
    canonicalName: "Bread and Beans",
    aliases: ["agege bread and beans", "butter beans and bread"],
    category: DishCategory.BREAKFAST,
    description: "Soft agege bread served with sweetened Nigerian brown or black-eyed beans.",
  },
];
