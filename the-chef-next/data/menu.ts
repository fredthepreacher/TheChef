export type MenuItem = { name: string; note: string };

export type MenuCategory = {
  id: string;
  title: string;
  description: string;
  /** Two columns of items, matching the original drawer layout. Empty for the custom card. */
  columns: [MenuItem[], MenuItem[]] | null;
};

export const menuCategories: MenuCategory[] = [
  {
    id: "appetizers",
    title: "Appetizers",
    description:
      "Handcrafted starters that set the tone — charcuterie boards, shrimp cocktail, caprese bites, wings, egg rolls, and more.",
    columns: [
      [
        { name: "Shrimp Cocktail", note: "lemon, cocktail sauce" },
        { name: "Charcuterie Board", note: "cured meats, cheeses, fruit, preserves" },
        { name: "Caprese Bites", note: "bocconcini, heirloom tomato, balsamic glaze" },
        { name: "Egg Rolls", note: "sweet chili dipping sauce" },
        { name: "Ham & Cheese Sliders", note: "honey mustard, brioche" },
      ],
      [
        { name: "Wings", note: "buffalo, bbq, or lemon pepper" },
        { name: "Turkey Pinwheels", note: "roasted red pepper, herb cream cheese" },
        { name: "Deviled Eggs", note: "classic recipe, paprika, chives" },
        { name: "Pineapple Teriyaki Meatballs", note: "scallions, sesame" },
        { name: "Customized Kabobs", note: "seasonal selections" },
      ],
    ],
  },
  {
    id: "mains",
    title: "Main Course",
    description:
      "Premium entrées from roasted chicken and jerk to baby back ribs, oxtail, beef brisket, lamb chops, and steak.",
    columns: [
      [
        { name: "Roasted Chicken", note: "herb jus" },
        { name: "Jerk Chicken", note: "scallions, citrus" },
        { name: "Curry Chicken", note: "coconut curry sauce" },
        { name: "BBQ Chicken", note: "smoky, tangy glaze" },
        { name: "Baby Back Ribs", note: "smoked, fall-off-the-bone" },
        { name: "Pulled Pork", note: "house bbq sauce" },
      ],
      [
        { name: "Beef Brisket", note: "slow-smoked, savory jus" },
        { name: "Oxtail", note: "braised, rich sauce" },
        { name: "Lamb Chops", note: "herb crusted, mint jus" },
        { name: "Steak", note: "sliced, chimichurri" },
        { name: "Turkey", note: "herb-roasted, pan gravy" },
      ],
    ],
  },
  {
    id: "seafood",
    title: "Seafood",
    description:
      "Lobster tail, salmon, shrimp linguini, seafood boils — every piece sourced fresh and prepared to perfection.",
    columns: [
      [
        { name: "Lobster", note: "drawn butter, lemon" },
        { name: "Salmon", note: "lemon herb butter" },
        { name: "Seafood Boil", note: "crab, shrimp, corn, potatoes" },
      ],
      [
        { name: "Shrimp Linguini", note: "garlic cream sauce, parmesan" },
        { name: "Shrimp Cocktail", note: "house cocktail sauce" },
        { name: "Custom Seafood Platter", note: "market selection, upon request" },
      ],
    ],
  },
  {
    id: "sides",
    title: "Sides & Bread",
    description:
      "Baked mac & cheese, collard greens, candied yams, rice and peas, pasta salad, cornbread — soul food elevated.",
    columns: [
      [
        { name: "Baked Macaroni & Cheese", note: "creamy, golden topping" },
        { name: "Collard Greens", note: "smoked turkey, garlic" },
        { name: "Sweet Potatoes", note: "brown sugar, cinnamon" },
        { name: "Rice & Peas", note: "coconut, scallions, thyme" },
        { name: "Mashed Potatoes", note: "creamy, roasted garlic" },
        { name: "Pasta Salad", note: "italian dressing, vegetables" },
      ],
      [
        { name: "Corn on the Cob", note: "butter, sea salt" },
        { name: "Mixed Vegetables", note: "seasonal medley" },
        { name: "Caesar Salad", note: "romaine, parmesan, croutons" },
        { name: "Baked Beans", note: "brown sugar, bacon" },
        { name: "Garlic Bread / Cornbread", note: "biscuits, garlic knots" },
        { name: "Coleslaw", note: "classic, creamy" },
      ],
    ],
  },
  {
    id: "desserts",
    title: "Desserts",
    description:
      "Cakes, pies, banana pudding, brownies, fruit platters, and chocolate-dipped strawberries for a sweet finish.",
    columns: [
      [
        { name: "Cakes", note: "chocolate, vanilla, red velvet, cheesecake, lemon" },
        { name: "Pies", note: "apple, pecan, key lime, cherry, chocolate silk" },
        { name: "Banana Pudding", note: "classic southern recipe" },
        { name: "Brownies", note: "fudge, walnut, peanut butter, white chocolate" },
      ],
      [
        { name: "Cookies", note: "chocolate chip, oatmeal, peanut butter, sugar" },
        { name: "Fruit Platters", note: "mixed, tropical, berry, seasonal" },
        { name: "Dessert Trifle Cups", note: "individual servings, seasonal flavors" },
        { name: "Custom Event Cake", note: "upon request, any occasion" },
      ],
    ],
  },
  {
    id: "custom",
    title: "Custom Menus",
    description:
      "Don't see what you need? Chef builds fully custom menus for weddings, corporate events, holidays, and meal prep.",
    columns: null,
  },
];

export const customMenuTags = [
  "Wedding Menus",
  "Corporate Catering",
  "Holiday Feasts",
  "Meal Prep",
  "Dietary Accommodations",
  "Seasonal Specials",
];

export type MenuDoc = {
  id: string;
  src: string;
  alt: string;
  title: string;
  subtitle: string;
};

export const menuDocs: MenuDoc[] = [
  {
    id: "menu-family",
    src: "/assets/menu_family_doc.png",
    alt: "Family Menu — The Chef Caters To You LLC",
    title: "Family Package Menu",
    subtitle: "Guest Specials · Family 8–12 · Starting at $800",
  },
  {
    id: "menu-full",
    src: "/assets/menu_full_doc.jpg",
    alt: "Full Catering Menu — The Chef's Catering Menu",
    title: "Full Catering Menu",
    subtitle: "Complete selections · All categories · Chef's Table Special Requests",
  },
];

export type Package = {
  badge: string;
  guests: string;
  price: { prefix: string; strong: string };
  features: string[];
  cta: string;
  featured?: boolean;
  tone: "silver" | "gold" | "platinum";
};

export const packages: Package[] = [
  {
    badge: "Silver",
    tone: "silver",
    guests: "Up to 25 Guests",
    price: { prefix: "Starting at ", strong: "$800" },
    features: [
      "Choice of 1 entrée",
      "2 signature sides",
      "1 appetizer tray",
      "Bread selection",
      "Setup & breakdown",
      "Serving utensils included",
    ],
    cta: "Get a Quote",
  },
  {
    badge: "Gold",
    tone: "gold",
    featured: true,
    guests: "Up to 50 Guests",
    price: { prefix: "Starting at ", strong: "$1,500" },
    features: [
      "Choice of 2 entrées",
      "3 signature sides",
      "2 appetizer trays",
      "Bread & dessert",
      "Setup & breakdown",
      "Chafing dishes included",
      "On-site chef attendance",
    ],
    cta: "Get a Quote",
  },
  {
    badge: "Platinum",
    tone: "platinum",
    guests: "50–200+ Guests",
    price: { prefix: "Custom ", strong: "Pricing" },
    features: [
      "Full custom menu design",
      "Unlimited entrée options",
      "Full appetizer spread",
      "Dessert station",
      "Full-service staff",
      "Premium plating & décor",
      "Weddings, corporate, events",
    ],
    cta: "Schedule Consultation",
  },
];
