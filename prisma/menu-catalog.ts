/** Official Roots Café menu — prices from printed menu (EUR). */

export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type MenuProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  sortOrder: number;
  allergens?: string;
  /** filename under uploads/menu/ — only set when a unique photo exists */
  imageFile?: string;
};

export const menuCategories: MenuCategory[] = [
  {
    id: 'menu-cat-hot',
    name: 'Hot Drinks',
    description: 'Espresso classics & steamed specialties',
    sortOrder: 1,
  },
  {
    id: 'menu-cat-cold',
    name: 'Cold Coffee & Iced Drinks',
    description: 'Iced coffee, tea & refreshers',
    sortOrder: 2,
  },
  {
    id: 'menu-cat-tea',
    name: 'Tea',
    description: 'Hot brewed teas',
    sortOrder: 3,
  },
  {
    id: 'menu-cat-matcha',
    name: 'Matcha',
    description: 'Ceremonial grade matcha drinks',
    sortOrder: 4,
  },
  {
    id: 'menu-cat-frappe',
    name: 'Frappes',
    description: 'Blended iced coffee treats',
    sortOrder: 5,
  },
  {
    id: 'menu-cat-milkshake',
    name: 'Milkshakes',
    description: 'Thick, creamy shakes',
    sortOrder: 6,
  },
];

const HOT = 'menu-cat-hot';
const COLD = 'menu-cat-cold';
const TEA = 'menu-cat-tea';
const MATCHA = 'menu-cat-matcha';
const FRAPPE = 'menu-cat-frappe';
const SHAKE = 'menu-cat-milkshake';

export const menuProducts: MenuProduct[] = [
  // Hot Drinks
  { id: 'menu-espresso', name: 'Espresso', description: 'Rich single shot espresso', price: 2.5, categoryId: HOT, sortOrder: 1 },
  { id: 'menu-cafe-creme', name: 'Café Crème', description: 'Espresso with steamed milk — regular', price: 2.8, categoryId: HOT, sortOrder: 2 },
  { id: 'menu-cortado', name: 'Cortado', description: 'Espresso cut with warm milk', price: 3.5, categoryId: HOT, sortOrder: 3 },
  { id: 'menu-flat-white', name: 'Flat White', description: 'Double shot with silky microfoam', price: 4.0, categoryId: HOT, sortOrder: 4, imageFile: 'flat-white.jpg' },
  { id: 'menu-spanish-latte', name: 'Spanish Latte', description: 'Sweetened condensed milk latte', price: 5.0, categoryId: HOT, sortOrder: 5, imageFile: 'spanish-latte.jpg' },
  { id: 'menu-cappuccino', name: 'Cappuccino', description: 'Espresso, steamed milk & foam', price: 3.5, categoryId: HOT, sortOrder: 6, imageFile: 'cappuccino.jpg', allergens: 'Milk' },
  { id: 'menu-latte', name: 'Latte', description: 'Smooth espresso with steamed milk', price: 4.0, categoryId: HOT, sortOrder: 7, imageFile: 'latte.jpg', allergens: 'Milk' },
  { id: 'menu-mochaccino', name: 'Mochaccino', description: 'Espresso, chocolate & steamed milk', price: 4.0, categoryId: HOT, sortOrder: 8, imageFile: 'mochaccino.jpg', allergens: 'Milk' },
  { id: 'menu-caramel-macchiato', name: 'Caramel Macchiato', description: 'Vanilla milk marked with espresso & caramel', price: 5.0, categoryId: HOT, sortOrder: 9, imageFile: 'caramel-macchiato.jpg', allergens: 'Milk' },
  { id: 'menu-chai-latte', name: 'Chai Latte', description: 'Spiced chai with steamed milk', price: 5.0, categoryId: HOT, sortOrder: 10, allergens: 'Milk' },
  { id: 'menu-latte-macchiato', name: 'Latte Macchiato', description: 'Steamed milk marked with espresso', price: 4.0, categoryId: HOT, sortOrder: 11, imageFile: 'latte-macchiato.jpg', allergens: 'Milk' },
  { id: 'menu-matcha-latte', name: 'Matcha Latte', description: 'Ceremonial matcha whisked with milk', price: 5.0, categoryId: HOT, sortOrder: 12, allergens: 'Milk' },
  { id: 'menu-hot-chocolate', name: 'Hot Chocolate', description: 'Rich cocoa drink', price: 3.8, categoryId: HOT, sortOrder: 13, imageFile: 'hot-chocolate.jpg', allergens: 'Milk' },
  { id: 'menu-hot-chocolate-sahne', name: 'Hot Chocolate mit Sahne', description: 'Hot chocolate topped with whipped cream', price: 4.5, categoryId: HOT, sortOrder: 14, allergens: 'Milk' },
  { id: 'menu-lavender-latte', name: 'Lavender Latte', description: 'Floral lavender infused latte', price: 5.0, categoryId: HOT, sortOrder: 15, imageFile: 'lavender-latte.jpg', allergens: 'Milk' },
  { id: 'menu-dirty-chai', name: 'Dirty Chai', description: 'Chai latte with a shot of espresso', price: 5.5, categoryId: HOT, sortOrder: 16, imageFile: 'dirty-chai.jpg', allergens: 'Milk' },

  // Cold Coffee & Iced Drinks
  { id: 'menu-iced-americano', name: 'Iced Americano', description: 'Espresso over ice & water', price: 3.5, categoryId: COLD, sortOrder: 1, imageFile: 'iced-americano.jpg' },
  { id: 'menu-iced-latte-macchiato', name: 'Iced Latte Macchiato', description: 'Chilled milk marked with espresso', price: 4.5, categoryId: COLD, sortOrder: 2, imageFile: 'iced-latte-macchiato.jpg', allergens: 'Milk' },
  { id: 'menu-iced-spanish-latte', name: 'Iced Spanish Latte', description: 'Iced sweet condensed milk latte', price: 5.0, categoryId: COLD, sortOrder: 3, imageFile: 'iced-spanish-latte.jpg', allergens: 'Milk' },
  { id: 'menu-iced-chai-latte', name: 'Iced Chai Latte', description: 'Spiced chai over ice', price: 5.0, categoryId: COLD, sortOrder: 4, imageFile: 'iced-chai-latte.jpg', allergens: 'Milk' },
  { id: 'menu-iced-lavender-latte', name: 'Iced Lavender Latte', description: 'Iced floral lavender latte', price: 5.0, categoryId: COLD, sortOrder: 5, imageFile: 'iced-lavender-latte.jpg', allergens: 'Milk' },
  { id: 'menu-iced-tea', name: 'Iced Tea', description: 'Chilled brewed tea', price: 3.5, categoryId: COLD, sortOrder: 6, imageFile: 'iced-tea.jpg' },
  { id: 'menu-juice', name: 'Juice', description: 'Fresh fruit juice', price: 3.0, categoryId: COLD, sortOrder: 7, imageFile: 'juice.jpg' },
  { id: 'menu-mojito', name: 'Mojito', description: 'Mint lime refresher (non-alcoholic)', price: 4.0, categoryId: COLD, sortOrder: 8 },

  // Tea
  { id: 'menu-english-breakfast', name: 'English Breakfast', description: 'Classic black tea', price: 2.0, categoryId: TEA, sortOrder: 1 },
  { id: 'menu-earl-grey', name: 'Earl Grey', description: 'Bergamot black tea', price: 3.0, categoryId: TEA, sortOrder: 2 },
  { id: 'menu-green-tea', name: 'Green Tea', description: 'Light green tea', price: 3.0, categoryId: TEA, sortOrder: 3 },

  // Matcha
  { id: 'menu-iced-matcha', name: 'Iced Matcha', description: 'Chilled matcha over ice', price: 5.0, categoryId: MATCHA, sortOrder: 1, imageFile: 'iced-matcha.jpg', allergens: 'Milk' },
  { id: 'menu-cloudy-matcha', name: 'Cloudy Matcha', description: 'Creamy cloudy matcha', price: 5.8, categoryId: MATCHA, sortOrder: 2, allergens: 'Milk' },
  { id: 'menu-iced-mango-matcha', name: 'Iced Mango Matcha', description: 'Mango & matcha over ice', price: 5.8, categoryId: MATCHA, sortOrder: 3, allergens: 'Milk' },
  { id: 'menu-iced-strawberry-matcha', name: 'Iced Strawberry Matcha', description: 'Strawberry & matcha over ice', price: 5.8, categoryId: MATCHA, sortOrder: 4, allergens: 'Milk' },
  { id: 'menu-lavender-matcha', name: 'Lavender Matcha', description: 'Lavender infused matcha', price: 5.8, categoryId: MATCHA, sortOrder: 5, allergens: 'Milk' },
  { id: 'menu-dirty-matcha', name: 'Dirty Matcha', description: 'Matcha with espresso', price: 6.0, categoryId: MATCHA, sortOrder: 6, allergens: 'Milk' },

  // Frappes
  { id: 'menu-caramel-frappe', name: 'Caramel Frappe', description: 'Blended coffee with caramel', price: 6.8, categoryId: FRAPPE, sortOrder: 1, imageFile: 'caramel-frappe.jpg', allergens: 'Milk' },
  { id: 'menu-strawberry-frappe', name: 'Strawberry Frappe', description: 'Blended strawberry frappe', price: 6.8, categoryId: FRAPPE, sortOrder: 2, imageFile: 'strawberry-frappe.jpg', allergens: 'Milk' },
  { id: 'menu-vanilla-frappe', name: 'Vanilla Frappe', description: 'Blended vanilla coffee frappe', price: 6.8, categoryId: FRAPPE, sortOrder: 3, imageFile: 'vanilla-frappe.jpg', allergens: 'Milk' },
  { id: 'menu-cookies-frappe', name: 'Cookies Frappe', description: 'Blended cookies & cream frappe', price: 6.8, categoryId: FRAPPE, sortOrder: 4, imageFile: 'cookies-frappe.jpg', allergens: 'Milk' },
  { id: 'menu-white-choco-frappe', name: 'White Choco Frappe', description: 'Blended white chocolate frappe', price: 6.8, categoryId: FRAPPE, sortOrder: 5, imageFile: 'white-choco-frappe.jpg', allergens: 'Milk' },

  // Milkshakes
  { id: 'menu-vanilla-milkshake', name: 'Vanilla Milkshake', description: 'Classic vanilla shake', price: 5.8, categoryId: SHAKE, sortOrder: 1, imageFile: 'vanilla-milkshake.jpg', allergens: 'Milk' },
  { id: 'menu-strawberry-milkshake', name: 'Strawberry Milkshake', description: 'Fresh strawberry shake', price: 5.8, categoryId: SHAKE, sortOrder: 2, allergens: 'Milk' },
  { id: 'menu-chocolate-milkshake', name: 'Chocolate Milkshake', description: 'Rich chocolate shake', price: 5.8, categoryId: SHAKE, sortOrder: 3, allergens: 'Milk' },
  { id: 'menu-oreo-milkshake', name: 'Oreo Milkshake', description: 'Cookies & cream shake', price: 6.4, categoryId: SHAKE, sortOrder: 4, allergens: 'Milk' },
  { id: 'menu-lotus-milkshake', name: 'Lotus Milkshake', description: 'Biscoff speculoos shake', price: 6.4, categoryId: SHAKE, sortOrder: 5, imageFile: 'lotus-milkshake.jpg', allergens: 'Milk' },
  { id: 'menu-mango-milkshake', name: 'Mango Milkshake', description: 'Tropical mango shake', price: 6.4, categoryId: SHAKE, sortOrder: 6, imageFile: 'mango-milkshake.jpg', allergens: 'Milk' },
];
