// Nigerian city and state reference data — derived from prisma/seed/cities.data.ts
// Used by intake.schema.ts for enum validation.
// Kept as a flat const array so Zod can derive a tuple type via z.enum().

export const NIGERIAN_STATE_NAMES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
] as const

export const NIGERIAN_CITY_NAMES = [
  // Federal Capital Territory
  'Abuja', 'Gwagwalada', 'Kuje', 'Bwari',
  // Lagos
  'Lagos', 'Lagos Island', 'Ikeja', 'Lekki', 'Victoria Island', 'Surulere',
  'Yaba', 'Apapa', 'Ajah', 'Ikorodu',
  // Rivers
  'Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme',
  // Kano
  'Kano', 'Wudil', 'Rano', 'Gwarzo',
  // Oyo
  'Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin',
  // Benue
  'Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala',
  // Kogi
  'Lokoja', 'Okene', 'Kabba', 'Idah',
  // Kwara
  'Ilorin', 'Offa', 'Lafiagi', 'Jebba',
  // Nasarawa
  'Lafia', 'Keffi', 'Nasarawa', 'Akwanga',
  // Niger
  'Minna', 'Bida', 'Suleja', 'Kontagora',
  // Plateau
  'Jos', 'Bukuru', 'Shendam', 'Pankshin',
  // Adamawa
  'Yola', 'Mubi', 'Jimeta', 'Numan',
  // Bauchi
  'Bauchi', 'Azare', 'Misau', 'Katagum',
  // Borno
  'Maiduguri', 'Biu', 'Gwoza', 'Monguno',
  // Gombe
  'Gombe', 'Kumo', 'Kaltungo', 'Billiri',
  // Taraba
  'Jalingo', 'Wukari', 'Bali', 'Gembu',
  // Yobe
  'Damaturu', 'Nguru', 'Potiskum', 'Gashua',
  // Jigawa
  'Dutse', 'Hadejia', 'Gumel', 'Birnin Kudu',
  // Kaduna
  'Kaduna', 'Zaria', 'Kafanchan', 'Kachia',
  // Katsina
  'Katsina', 'Daura', 'Funtua', 'Mashi',
  // Kebbi
  'Birnin Kebbi', 'Argungu', 'Yelwa', 'Zuru',
  // Sokoto
  'Sokoto', 'Tambuwal', 'Gwadabawa', 'Illela',
  // Zamfara
  'Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka',
  // Abia
  'Umuahia', 'Aba', 'Arochukwu', 'Ohafia',
  // Anambra
  'Awka', 'Onitsha', 'Nnewi', 'Ekwulobia',
  // Ebonyi
  'Abakaliki', 'Onueke', 'Afikpo', 'Ishielu',
  // Enugu
  'Enugu', 'Nsukka', 'Oji River', 'Awgu',
  // Imo
  'Owerri', 'Orlu', 'Okigwe', 'Mbaise',
  // Akwa Ibom
  'Uyo', 'Eket', 'Ikot Ekpene', 'Abak',
  // Bayelsa
  'Yenagoa', 'Ogbia', 'Sagbama', 'Brass',
  // Cross River
  'Calabar', 'Ikom', 'Ogoja', 'Obudu',
  // Delta
  'Asaba', 'Warri', 'Sapele', 'Ughelli',
  // Edo
  'Benin City', 'Auchi', 'Uromi', 'Ekpoma',
  // Ekiti
  'Ado-Ekiti', 'Ikere-Ekiti', 'Ijero-Ekiti', 'Efon-Alaaye',
  // Ogun
  'Abeokuta', 'Sagamu', 'Ijebu-Ode', 'Ota',
  // Ondo
  'Akure', 'Ondo City', 'Owo', 'Ikare-Akoko',
  // Osun
  'Osogbo', 'Ile-Ife', 'Ilesa', 'Ede',
] as const

export type NigerianStateName = (typeof NIGERIAN_STATE_NAMES)[number]
export type NigerianCityName  = (typeof NIGERIAN_CITY_NAMES)[number]
