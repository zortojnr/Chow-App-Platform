// Initial restaurant dataset — Abuja, Phase 1.
// Source: internal_dataset. Seeded as APPROVED.
// Governed by: database-track.md §6

import { PriceRange } from "@prisma/client";

export interface RestaurantSeedDish {
  canonicalName: string; // must match DishTaxonomy.canonicalName exactly
  nameAsServed?: string;
  price?: number; // naira, no decimals
}

export interface RestaurantSeedEntry {
  name: string;
  slug: string;
  description?: string;
  address: string;
  area?: string;
  city: string;
  state: string;
  phone?: string;
  priceRange: PriceRange;
  cuisineTypes: string[];
  dishes: RestaurantSeedDish[];
}

export const RESTAURANTS: RestaurantSeedEntry[] = [

  // ─── CENTRAL AREA ───────────────────────────────────────────

  {
    name: "The Burgundy by Chef Stone",
    slug: "the-burgundy-by-chef-stone",
    description:
      "Nigeria's premier reservation-only fine dining restaurant in Maitama, offering an immersive and highly curated 7-course Pan-African tasting menu curated by Executive Chef Stone.",
    address: "990 NAL Boulevard, Behind Fraser Suites, Central Area",
    area: "Central Area",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348094111112",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["African", "Fine Dining"],
    dishes: [],
  },
  {
    name: "Nkoyo",
    slug: "nkoyo",
    description:
      "A beautifully styled, picturesque restaurant utilizing rustic bamboo and wooden decor, serving rich, authentic traditional Nigerian meals prepared with fresh local herbs.",
    address: "Ceddi Plaza, 264 Tafawa Balewa Road, Central Area",
    area: "Central Area",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348153221279",
    priceRange: PriceRange.MID,
    cuisineTypes: ["Nigerian", "African", "Vegetarian"],
    dishes: [
      { canonicalName: "Peppered Chicken", nameAsServed: "Grilled Pepper Wings", price: 1500 },
    ],
  },

  // ─── WUSE II ────────────────────────────────────────────────

  {
    name: "Gusto",
    slug: "gusto",
    description:
      "A chic and stylish dining spot in Wuse II, serving an exceptional fusion of Italian and Asian dishes, featuring live teppanyaki shows and fresh pasta cooked in a giant cheese wheel.",
    address: "42 Adetokunbo Ademola Crescent, Wuse II",
    area: "Wuse II",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2349063665554",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["Italian", "Japanese", "International"],
    dishes: [
      { canonicalName: "Pasta", nameAsServed: "Parmigiano Wheel Pasta", price: 25000 },
    ],
  },
  {
    name: "Salamander Café",
    slug: "salamander-cafe",
    description:
      "A landmark, cozy European-style café and hangout in Wuse II, complete with table call buttons, an integrated bookstore for local authors, and premium coffees.",
    address: "15b Parakou Street, Off Aminu Kano Crescent, Wuse II",
    area: "Wuse II",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348092204424",
    priceRange: PriceRange.MID,
    cuisineTypes: ["Café", "Pastries", "Inter-Continental"],
    dishes: [
      { canonicalName: "Club Sandwich", nameAsServed: "Gourmet Club Sandwich" },
    ],
  },
  {
    name: "Tar Tar",
    slug: "tar-tar",
    description:
      "A contemporary, architecturally chic bistro in Wuse II blending premium Asian culinary techniques with rich West African soul, serving oysters, dim sum, and local favorites.",
    address: "5 Sorotona Close, Wuse II, Off Blantyre Street",
    area: "Wuse II",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348108306948",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["Asian Fusion", "Seafood", "Nigerian Soul"],
    dishes: [
      { canonicalName: "Calamari", nameAsServed: "Crispy Calamari Strips", price: 25000 },
    ],
  },
  {
    name: "Lagos Bistro",
    slug: "lagos-bistro",
    description:
      "A buzzing, high-tempo venue in Wuse II designed to import the legendary Lagos social energy to the capital, serving affordable continental bites and spicy stews.",
    address: "7 Hombori Street, Adetokunbo Ademola Crescent, Wuse II",
    area: "Wuse II",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2347043800000",
    priceRange: PriceRange.BUDGET,
    cuisineTypes: ["Nigerian", "Café", "International"],
    dishes: [
      { canonicalName: "Pasta", nameAsServed: "Bistro Alfredo Pasta", price: 22988 },
    ],
  },
  {
    name: "Sketch Restaurant",
    slug: "sketch-restaurant",
    description:
      "Abuja's premier 2D/3D art-themed diner in Wuse II, meticulously hand-drawn to look like a giant sketch illustration, offering visual pastries, coffee, and continental lunches.",
    address: "Art Tech District, 7 Hombori Street, Wuse II",
    area: "Wuse II",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348109282084",
    priceRange: PriceRange.BUDGET,
    cuisineTypes: ["Café", "Pastries", "Continental"],
    dishes: [
      { canonicalName: "Burger", nameAsServed: "Handcrafted Gourmet Burger" },
    ],
  },

  // ─── JABI ───────────────────────────────────────────────────

  {
    name: "Uncle T's",
    slug: "uncle-ts",
    description:
      "Located opposite Jabi Lake, this premium comfort diner offers a highly relaxing workspace environment and delicious global fusion meals like avo feta sourdough toast.",
    address: "51 Alex Ekwueme Way, Opp. Jabi Lake, Jabi",
    area: "Jabi",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2349155559565",
    priceRange: PriceRange.MID,
    cuisineTypes: ["Breakfast", "Inter-Continental", "Pasta"],
    dishes: [
      { canonicalName: "Breakfast Platter", nameAsServed: "Famous Breakfast Platter", price: 18000 },
    ],
  },
  {
    name: "Argungu",
    slug: "argungu",
    description:
      "A refined seafood and African fusion restaurant situated directly on the Jabi Lake waterfront within the Jabi Lake Mall. Widely noted for its scenic lake views, professional service, and a menu that balances authentic Nigerian recipes with international seafood preparations. The ambiance is relaxed and often features live music, making it a popular spot for both casual dining and special gatherings.",
    address: "Jabi Lake Waterfront, Jabi Lake Mall, Bala Sokoto Way, Jabi",
    area: "Jabi",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348110551794",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["Seafood", "Barbecue", "Indian"],
    dishes: [
      { canonicalName: "Grilled Fish", nameAsServed: "Charcoal Grilled Fish" },
    ],
  },
  {
    name: "Coco Café",
    slug: "coco-cafe",
    description:
      "A modern rooftop café in Jabi overlooking Jabi Lake, featuring gorgeous microclimate vistas, premium wood-fired Hawaiian pizzas, and a relaxed outdoor deck setting.",
    address: "466 Alex Ekwueme Way, Jabi Lake, Jabi",
    area: "Jabi",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348097088270",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["Barbecue", "Burgers", "Pizza", "Lebanese"],
    dishes: [
      { canonicalName: "Pizza", nameAsServed: "Fresh Hawaiian Wood-Fired Pizza" },
    ],
  },

  // ─── KADO ───────────────────────────────────────────────────

  {
    name: "The Pier Restaurant & Lounge",
    slug: "the-pier-restaurant-and-lounge",
    description:
      "A beautiful, modern waterfront dining destination on Ahmadu Bello Way in Kado, offering breathtaking lake views and exceptional seafood and continental plates.",
    address: "Plot 498 Ahmadu Bello Way, Kado",
    area: "Kado",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2347065437384",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["Seafood", "Italian", "Nigerian", "Lounge"],
    dishes: [
      { canonicalName: "Pasta", nameAsServed: "Seafood Pasta" },
    ],
  },

  // ─── MAITAMA ────────────────────────────────────────────────

  {
    name: "Chez Victor",
    slug: "chez-victor",
    description:
      "A secluded French fine-dining venue tucked inside Maitama's secure embassy district, curated by London-trained Executive Chef Victor Kueviakoe in a quiet villa setting.",
    address: "7 Ganges Street, Ministers Hill, Maitama",
    area: "Maitama",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348155190829",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["French", "Seafood", "African"],
    dishes: [],
  },
  {
    name: "Flour Café",
    slug: "flour-cafe",
    description:
      "A charming and cozy boutique café at Cappador Mall in Maitama, popular for its beautiful artisanal coffee, fresh pastries, and signature breakfast crepes and pancakes.",
    address: "Cappador Mall, Aguiyi Ironsi Street, Maitama",
    area: "Maitama",
    city: "Abuja",
    state: "Federal Capital Territory",
    priceRange: PriceRange.MID,
    cuisineTypes: ["Café", "Pastries", "Breakfast"],
    dishes: [
      { canonicalName: "Crepes", nameAsServed: "Signature Breakfast Crepes" },
    ],
  },

  // ─── GWARINPA ───────────────────────────────────────────────

  {
    name: "Aunty Mary's Cuisine",
    slug: "aunty-marys-cuisine",
    description:
      "A popular 24-hour casual dining hub and arcade in Gwarinpa, offering local swallows, fresh grills, and fast-delivery services around the clock.",
    address: "2XL Mall, Off 3rd Avenue, Gwarinpa",
    area: "Gwarinpa",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2349112223306",
    priceRange: PriceRange.BUDGET,
    cuisineTypes: ["Nigerian", "Grills", "Fast Casual"],
    dishes: [
      { canonicalName: "Peppered Chicken", nameAsServed: "Signature Charcoal Chicken" },
    ],
  },

  // ─── GARKI ──────────────────────────────────────────────────

  {
    name: "Sinoni Chinese Restaurant",
    slug: "sinoni-chinese-restaurant",
    description:
      "An established, authentic Chinese restaurant in Zeto Court, Garki Area 11, highly regarded for its traditional oriental atmosphere and seven private dining rooms designed for intimate, culturally immersive group experiences. A staple for both the Chinese expat community and locals, known for high-quality service and sophisticated food presentation.",
    address: "3 Zeto Court, Oshogbo Close, Area 11, Garki",
    area: "Garki",
    city: "Abuja",
    state: "Federal Capital Territory",
    phone: "+2348060958818",
    priceRange: PriceRange.UPSCALE,
    cuisineTypes: ["Chinese", "Asian"],
    dishes: [
      { canonicalName: "Beef Stir Fry", nameAsServed: "Sizzling Beef in Oyster Sauce" },
    ],
  },
];
