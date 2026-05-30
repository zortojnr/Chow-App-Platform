export interface StateSeedEntry {
  name: string;
  abbreviation: string;
  capital: string;
  geopoliticalZone: string;
  majorCities: string[];
}

export const NIGERIAN_STATES: StateSeedEntry[] = [
  // ─── NORTH CENTRAL ───────────────────────────────────────────
  {
    name: "Benue",
    abbreviation: "BN",
    capital: "Makurdi",
    geopoliticalZone: "North Central",
    majorCities: ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala"],
  },
  {
    name: "Kogi",
    abbreviation: "KG",
    capital: "Lokoja",
    geopoliticalZone: "North Central",
    majorCities: ["Lokoja", "Okene", "Kabba", "Idah"],
  },
  {
    name: "Kwara",
    abbreviation: "KW",
    capital: "Ilorin",
    geopoliticalZone: "North Central",
    majorCities: ["Ilorin", "Offa", "Lafiagi", "Jebba"],
  },
  {
    name: "Nasarawa",
    abbreviation: "NA",
    capital: "Lafia",
    geopoliticalZone: "North Central",
    majorCities: ["Lafia", "Keffi", "Nasarawa", "Akwanga"],
  },
  {
    name: "Niger",
    abbreviation: "NI",
    capital: "Minna",
    geopoliticalZone: "North Central",
    majorCities: ["Minna", "Bida", "Suleja", "Kontagora"],
  },
  {
    name: "Plateau",
    abbreviation: "PL",
    capital: "Jos",
    geopoliticalZone: "North Central",
    majorCities: ["Jos", "Bukuru", "Shendam", "Pankshin"],
  },
  {
    name: "Federal Capital Territory",
    abbreviation: "FCT",
    capital: "Abuja",
    geopoliticalZone: "North Central",
    majorCities: ["Abuja", "Gwagwalada", "Kuje", "Bwari"],
  },

  // ─── NORTH EAST ───────────────────────────────────────────────
  {
    name: "Adamawa",
    abbreviation: "AD",
    capital: "Yola",
    geopoliticalZone: "North East",
    majorCities: ["Yola", "Mubi", "Jimeta", "Numan"],
  },
  {
    name: "Bauchi",
    abbreviation: "BA",
    capital: "Bauchi",
    geopoliticalZone: "North East",
    majorCities: ["Bauchi", "Azare", "Misau", "Katagum"],
  },
  {
    name: "Borno",
    abbreviation: "BO",
    capital: "Maiduguri",
    geopoliticalZone: "North East",
    majorCities: ["Maiduguri", "Biu", "Gwoza", "Monguno"],
  },
  {
    name: "Gombe",
    abbreviation: "GO",
    capital: "Gombe",
    geopoliticalZone: "North East",
    majorCities: ["Gombe", "Kumo", "Kaltungo", "Billiri"],
  },
  {
    name: "Taraba",
    abbreviation: "TA",
    capital: "Jalingo",
    geopoliticalZone: "North East",
    majorCities: ["Jalingo", "Wukari", "Bali", "Gembu"],
  },
  {
    name: "Yobe",
    abbreviation: "YO",
    capital: "Damaturu",
    geopoliticalZone: "North East",
    majorCities: ["Damaturu", "Nguru", "Potiskum", "Gashua"],
  },

  // ─── NORTH WEST ───────────────────────────────────────────────
  {
    name: "Jigawa",
    abbreviation: "JI",
    capital: "Dutse",
    geopoliticalZone: "North West",
    majorCities: ["Dutse", "Hadejia", "Gumel", "Birnin Kudu"],
  },
  {
    name: "Kaduna",
    abbreviation: "KD",
    capital: "Kaduna",
    geopoliticalZone: "North West",
    majorCities: ["Kaduna", "Zaria", "Kafanchan", "Kachia"],
  },
  {
    name: "Kano",
    abbreviation: "KN",
    capital: "Kano",
    geopoliticalZone: "North West",
    majorCities: ["Kano", "Wudil", "Rano", "Gwarzo"],
  },
  {
    name: "Katsina",
    abbreviation: "KT",
    capital: "Katsina",
    geopoliticalZone: "North West",
    majorCities: ["Katsina", "Daura", "Funtua", "Mashi"],
  },
  {
    name: "Kebbi",
    abbreviation: "KE",
    capital: "Birnin Kebbi",
    geopoliticalZone: "North West",
    majorCities: ["Birnin Kebbi", "Argungu", "Yelwa", "Zuru"],
  },
  {
    name: "Sokoto",
    abbreviation: "SO",
    capital: "Sokoto",
    geopoliticalZone: "North West",
    majorCities: ["Sokoto", "Tambuwal", "Gwadabawa", "Illela"],
  },
  {
    name: "Zamfara",
    abbreviation: "ZA",
    capital: "Gusau",
    geopoliticalZone: "North West",
    majorCities: ["Gusau", "Kaura Namoda", "Talata Mafara", "Anka"],
  },

  // ─── SOUTH EAST ───────────────────────────────────────────────
  {
    name: "Abia",
    abbreviation: "AB",
    capital: "Umuahia",
    geopoliticalZone: "South East",
    majorCities: ["Umuahia", "Aba", "Arochukwu", "Ohafia"],
  },
  {
    name: "Anambra",
    abbreviation: "AN",
    capital: "Awka",
    geopoliticalZone: "South East",
    majorCities: ["Awka", "Onitsha", "Nnewi", "Ekwulobia"],
  },
  {
    name: "Ebonyi",
    abbreviation: "EB",
    capital: "Abakaliki",
    geopoliticalZone: "South East",
    majorCities: ["Abakaliki", "Onueke", "Afikpo", "Ishielu"],
  },
  {
    name: "Enugu",
    abbreviation: "EN",
    capital: "Enugu",
    geopoliticalZone: "South East",
    majorCities: ["Enugu", "Nsukka", "Oji River", "Awgu"],
  },
  {
    name: "Imo",
    abbreviation: "IM",
    capital: "Owerri",
    geopoliticalZone: "South East",
    majorCities: ["Owerri", "Orlu", "Okigwe", "Mbaise"],
  },

  // ─── SOUTH SOUTH ───────────────────────────────────────────────
  {
    name: "Akwa Ibom",
    abbreviation: "AK",
    capital: "Uyo",
    geopoliticalZone: "South South",
    majorCities: ["Uyo", "Eket", "Ikot Ekpene", "Abak"],
  },
  {
    name: "Bayelsa",
    abbreviation: "BY",
    capital: "Yenagoa",
    geopoliticalZone: "South South",
    majorCities: ["Yenagoa", "Ogbia", "Sagbama", "Brass"],
  },
  {
    name: "Cross River",
    abbreviation: "CR",
    capital: "Calabar",
    geopoliticalZone: "South South",
    majorCities: ["Calabar", "Ikom", "Ogoja", "Obudu"],
  },
  {
    name: "Delta",
    abbreviation: "DE",
    capital: "Asaba",
    geopoliticalZone: "South South",
    majorCities: ["Asaba", "Warri", "Sapele", "Ughelli"],
  },
  {
    name: "Edo",
    abbreviation: "ED",
    capital: "Benin City",
    geopoliticalZone: "South South",
    majorCities: ["Benin City", "Auchi", "Uromi", "Ekpoma"],
  },
  {
    name: "Rivers",
    abbreviation: "RI",
    capital: "Port Harcourt",
    geopoliticalZone: "South South",
    majorCities: ["Port Harcourt", "Obio-Akpor", "Bonny", "Eleme"],
  },

  // ─── SOUTH WEST ───────────────────────────────────────────────
  {
    name: "Ekiti",
    abbreviation: "EK",
    capital: "Ado-Ekiti",
    geopoliticalZone: "South West",
    majorCities: ["Ado-Ekiti", "Ikere-Ekiti", "Ijero-Ekiti", "Efon-Alaaye"],
  },
  {
    name: "Lagos",
    abbreviation: "LA",
    capital: "Ikeja",
    geopoliticalZone: "South West",
    majorCities: ["Lagos Island", "Ikeja", "Lekki", "Victoria Island", "Surulere", "Yaba", "Apapa", "Ajah", "Ikorodu"],
  },
  {
    name: "Ogun",
    abbreviation: "OG",
    capital: "Abeokuta",
    geopoliticalZone: "South West",
    majorCities: ["Abeokuta", "Sagamu", "Ijebu-Ode", "Ota"],
  },
  {
    name: "Ondo",
    abbreviation: "ON",
    capital: "Akure",
    geopoliticalZone: "South West",
    majorCities: ["Akure", "Ondo City", "Owo", "Ikare-Akoko"],
  },
  {
    name: "Osun",
    abbreviation: "OS",
    capital: "Osogbo",
    geopoliticalZone: "South West",
    majorCities: ["Osogbo", "Ile-Ife", "Ilesa", "Ede"],
  },
  {
    name: "Oyo",
    abbreviation: "OY",
    capital: "Ibadan",
    geopoliticalZone: "South West",
    majorCities: ["Ibadan", "Ogbomosho", "Oyo", "Iseyin"],
  },
];

// Flat list of all cities for autocomplete/search use
export const ALL_CITIES: Array<{ city: string; state: string }> =
  NIGERIAN_STATES.flatMap((s) =>
    [s.capital, ...s.majorCities]
      .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
      .map((city) => ({ city, state: s.name }))
  );
