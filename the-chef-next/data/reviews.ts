export type Review = {
  name: string;
  event: string;
  /** Quote with optional <strong> emphasis segments. */
  quote: Array<{ text: string; strong?: boolean }>;
  tags?: string[];
  platform?: "facebook" | "google";
  /** Extra highlight quotes — used by the wide featured card. */
  highlights?: Array<Array<{ text: string; strong?: boolean }>>;
  wide?: boolean;
};

export const reviews: Review[] = [
  {
    name: "Britney Johnson",
    event: "Wedding Reception · November 2025",
    wide: true,
    platform: "facebook",
    quote: [
      { text: "We hired Chef to cater our wedding of about 50 people, and I truly cannot say enough good things. The prices were amazing, he worked with us every step of the way, and " },
      { text: "the food was such a hit that guests were asking all night where it came from.", strong: true },
      { text: " People were even packing up leftovers to take home because it was that good." },
    ],
    highlights: [
      [
        { text: "“The setup was perfect, the vibes were perfect, and " },
        { text: "he even dressed to match our wedding theme", strong: true },
        { text: " which was such a thoughtful touch. Everything exceeded our expectations.”" },
      ],
      [
        { text: "“We honestly could not have chosen a better person to absolutely crush it. " },
        { text: "Highly, highly recommend! You will NOT be disappointed.", strong: true },
        { text: "”" },
      ],
    ],
    tags: ["Delicious Food", "Good for Parties", "Professional Staff", "Creative Cuisine", "Personalised Menus"],
  },
  {
    name: "Linda Zambaldi",
    event: "Private Dinner · Google Review",
    platform: "google",
    quote: [
      { text: "I would hire Chef Frankie again in an instant. His food was absolutely delicious. " },
      { text: "The presentation was like something out of a magazine.", strong: true },
      { text: " The sauce on the beef tenderloin crostini was fabulous and I could have eaten his homemade dumplings by the dozens." },
    ],
  },
  {
    name: "Courteney Longsworth",
    event: "Baby Shower · October 2025",
    quote: [
      { text: "The chef catered my baby shower and I was blown away by " },
      { text: "the attention to detail — not just the food but the presentation as well.", strong: true },
      { text: " Very fair with the price and always returned my phone calls or texts. If you need a dependable caterer, I'd always recommend The Chef Catering Services!" },
    ],
    tags: ["Great Value", "Dependable", "Personalised Menus"],
  },
  {
    name: "Bobbie Leahey",
    event: "Private Event · July 2024",
    quote: [
      { text: "Chef exceeded all my expectations. " },
      { text: "Delivered an unforgettable experience that contributed significantly to the success of our event.", strong: true },
      { text: " I highly recommend their services." },
    ],
    tags: ["Professional Staff", "Experienced Chefs", "Great Value"],
  },
  {
    name: "Xavier Lazo",
    event: "Party Catering · July 2023",
    quote: [
      { text: "Some of the best food I've ever had — 10/10.", strong: true },
      { text: " I would recommend to anyone who's hosting a party and wants to wow their guests. Perfect service." },
    ],
    tags: ["Delicious Food", "Creative Cuisine", "Good for Parties"],
  },
  {
    name: "Eric Hoeberling",
    event: "Signature Dish · June 2024",
    quote: [
      { text: "Just tried the jerk chicken and pasta plate and it was absolutely phenomenal!", strong: true },
      { text: " I cannot recommend this enough." },
    ],
  },
  {
    name: "Melonda Perez",
    event: "Repeat Client · July 2023",
    quote: [
      { text: "Exceeded my expectations", strong: true },
      { text: " — using The Chef CS for all of my events! Thank you!!" },
    ],
    tags: ["Great Value", "Creative Cuisine", "Professional Staff"],
  },
  {
    name: "Marrissa Lynf8",
    event: "Private Order · November 2021",
    quote: [
      { text: "Love the diversity of the menu. Ordered the lobster and shrimp pasta — it was amazing, very flavorful and fresh. " },
      { text: "Really enjoyed the presentation & portion size. I will definitely be ordering again.", strong: true },
    ],
    tags: ["Delicious Food", "Great Value", "Professional Staff"],
  },
  {
    name: "Ray Lussier",
    event: "Catering Event · August 2022",
    quote: [
      { text: "Amazing food, great and friendly guy!", strong: true },
      { text: " Would 1000% order again — can't wait to see the oxtail again!" },
    ],
    tags: ["Experienced Chefs", "Creative Cuisine", "Delicious Food"],
  },
];

/** Homepage preview — the three short cards shown on index. */
export const homeReviews = [
  {
    name: "Britney Johnson",
    event: "Wedding Reception",
    quote: [
      { text: "“We hired Chef to cater our wedding of about 50 people, and I truly cannot say enough good things. " },
      { text: "The food was such a hit that guests were asking all night where it came from.", strong: true },
      { text: " People were even packing up leftovers to take home because it was that good.”" },
    ],
  },
  {
    name: "Linda Zambaldi",
    event: "Private Dinner",
    quote: [
      { text: "“I would hire Chef Frankie again in an instant. " },
      { text: "The presentation was like something out of a magazine.", strong: true },
      { text: " I was very particular about my menu and he tweaked it so it was exactly what I wanted. Hire him. You won't be sorry.”" },
    ],
  },
  {
    name: "Courteney Longsworth",
    event: "Baby Shower",
    quote: [
      { text: "“The chef catered my baby shower and I was blown away by " },
      { text: "the attention to detail — not just the food but the presentation as well.", strong: true },
      { text: " If you need a dependable caterer, I'd always recommend The Chef Catering Services!”" },
    ],
  },
];
