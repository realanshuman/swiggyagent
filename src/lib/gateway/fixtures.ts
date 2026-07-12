import type { Address, DineoutRestaurant, MenuItem, Product, Restaurant } from "../types";

export const ADDRESSES: Address[] = [
  { id: "addr-home", label: "Home", line: "221, 4th Cross, HAL 2nd Stage", area: "Indiranagar", city: "Bengaluru" },
  { id: "addr-work", label: "Work", line: "WeWork Galaxy, 43 Residency Rd", area: "Ashok Nagar", city: "Bengaluru" },
];

export const RESTAURANTS: Restaurant[] = [
  { id: "r-rolls", name: "Kolkata Roll Express", cuisines: ["Rolls", "Kathi", "Bengali"], rating: 4.4, ratingCount: "12K+", etaMinutes: 22, priceForTwo: 300, offer: "50% OFF up to ₹100", area: "Indiranagar", imageEmoji: "🌯" },
  { id: "r-biryani", name: "Meghana Foods", cuisines: ["Biryani", "Andhra", "North Indian"], rating: 4.6, ratingCount: "58K+", etaMinutes: 28, priceForTwo: 500, offer: "₹125 OFF above ₹499", area: "Residency Road", imageEmoji: "🍛" },
  { id: "r-pizza", name: "Slice of Napoli", cuisines: ["Pizza", "Italian"], rating: 4.3, ratingCount: "8K+", etaMinutes: 25, priceForTwo: 600, area: "Domlur", imageEmoji: "🍕" },
  { id: "r-south", name: "Vidyarthi Bhavan Express", cuisines: ["South Indian", "Dosa"], rating: 4.5, ratingCount: "21K+", etaMinutes: 18, priceForTwo: 200, offer: "FREE delivery", area: "Indiranagar", imageEmoji: "🥞" },
  { id: "r-chinese", name: "Mainland Dragon", cuisines: ["Chinese", "Momos", "Noodles"], rating: 4.1, ratingCount: "5K+", etaMinutes: 30, priceForTwo: 400, area: "Koramangala", imageEmoji: "🥡" },
  { id: "r-healthy", name: "Salad Days", cuisines: ["Healthy", "Salads", "Bowls"], rating: 4.4, ratingCount: "3K+", etaMinutes: 24, priceForTwo: 450, offer: "20% OFF", area: "Indiranagar", imageEmoji: "🥗" },
];

export const MENUS: Record<string, MenuItem[]> = {
  "r-rolls": [
    { id: "m-ptr", restaurantId: "r-rolls", name: "Paneer Tikka Roll", description: "Char-grilled paneer, mint chutney, laccha onions in a flaky paratha", price: 189, isVeg: true, rating: 4.5, bestseller: true, customizations: [{ name: "Extras", options: [{ label: "Extra paneer", delta: 49 }, { label: "Cheese slice", delta: 25 }] }] },
    { id: "m-ckr", restaurantId: "r-rolls", name: "Chicken Kathi Roll", description: "Classic Kolkata-style double egg chicken roll", price: 219, isVeg: false, rating: 4.6, bestseller: true },
    { id: "m-egr", restaurantId: "r-rolls", name: "Double Egg Roll", price: 149, isVeg: false, rating: 4.3 },
    { id: "m-alr", restaurantId: "r-rolls", name: "Aloo Masala Roll", price: 129, isVeg: true, rating: 4.1 },
    { id: "m-gulab", restaurantId: "r-rolls", name: "Gulab Jamun (2 pc)", price: 89, isVeg: true, rating: 4.4 },
  ],
  "r-biryani": [
    { id: "m-cbir", restaurantId: "r-biryani", name: "Chicken Boneless Biryani", description: "Signature spicy Andhra-style biryani", price: 329, isVeg: false, rating: 4.7, bestseller: true },
    { id: "m-vbir", restaurantId: "r-biryani", name: "Veg Biryani", price: 249, isVeg: true, rating: 4.2 },
    { id: "m-p65", restaurantId: "r-biryani", name: "Paneer 65", price: 259, isVeg: true, rating: 4.4 },
    { id: "m-raita", restaurantId: "r-biryani", name: "Raita", price: 49, isVeg: true },
  ],
  "r-pizza": [
    { id: "m-marg", restaurantId: "r-pizza", name: "Margherita", description: "San Marzano tomato, fior di latte, basil", price: 349, isVeg: true, rating: 4.5, bestseller: true },
    { id: "m-pepp", restaurantId: "r-pizza", name: "Pepperoni", price: 449, isVeg: false, rating: 4.4 },
    { id: "m-garlic", restaurantId: "r-pizza", name: "Garlic Bread", price: 179, isVeg: true },
  ],
  "r-south": [
    { id: "m-mdosa", restaurantId: "r-south", name: "Masala Dosa", description: "Crisp dosa with potato palya, benne on top", price: 120, isVeg: true, rating: 4.6, bestseller: true },
    { id: "m-idli", restaurantId: "r-south", name: "Idli Vada (2+1)", price: 90, isVeg: true, rating: 4.4 },
    { id: "m-filter", restaurantId: "r-south", name: "Filter Coffee", price: 40, isVeg: true, rating: 4.7 },
  ],
  "r-chinese": [
    { id: "m-vmomo", restaurantId: "r-chinese", name: "Veg Steamed Momos (8 pc)", price: 159, isVeg: true, rating: 4.2 },
    { id: "m-cnood", restaurantId: "r-chinese", name: "Chicken Hakka Noodles", price: 229, isVeg: false, rating: 4.3, bestseller: true },
    { id: "m-chilli", restaurantId: "r-chinese", name: "Chilli Paneer", price: 249, isVeg: true, rating: 4.1 },
  ],
  "r-healthy": [
    { id: "m-cbowl", restaurantId: "r-healthy", name: "Grilled Chicken Bowl", price: 329, isVeg: false, rating: 4.5, bestseller: true },
    { id: "m-fbowl", restaurantId: "r-healthy", name: "Falafel Hummus Bowl", price: 299, isVeg: true, rating: 4.4 },
    { id: "m-smoothie", restaurantId: "r-healthy", name: "Peanut Butter Smoothie", price: 189, isVeg: true },
  ],
};

export const PRODUCTS: Product[] = [
  { id: "p-milk", name: "Nandini Toned Milk", brand: "Nandini", quantityLabel: "1 L", price: 56, mrp: 58, category: "Dairy", etaMinutes: 9, imageEmoji: "🥛", inStock: true },
  { id: "p-eggs", name: "Farm Fresh White Eggs", brand: "Suguna", quantityLabel: "12 pc", price: 96, mrp: 110, category: "Dairy", etaMinutes: 9, imageEmoji: "🥚", inStock: true },
  { id: "p-bread", name: "Whole Wheat Bread", brand: "Britannia", quantityLabel: "400 g", price: 55, mrp: 60, category: "Bakery", etaMinutes: 9, imageEmoji: "🍞", inStock: true },
  { id: "p-maggi", name: "Maggi 2-Minute Noodles", brand: "Nestlé", quantityLabel: "12-pack", price: 168, mrp: 180, category: "Instant Food", etaMinutes: 9, imageEmoji: "🍜", inStock: true },
  { id: "p-butter", name: "Amul Butter", brand: "Amul", quantityLabel: "500 g", price: 305, mrp: 315, category: "Dairy", etaMinutes: 9, imageEmoji: "🧈", inStock: true },
  { id: "p-banana", name: "Robusta Banana", brand: "Fresh", quantityLabel: "6 pc", price: 42, mrp: 48, category: "Fruits", etaMinutes: 9, imageEmoji: "🍌", inStock: true },
  { id: "p-onion", name: "Onion", brand: "Fresh", quantityLabel: "1 kg", price: 38, mrp: 45, category: "Vegetables", etaMinutes: 9, imageEmoji: "🧅", inStock: true },
  { id: "p-tomato", name: "Tomato Local", brand: "Fresh", quantityLabel: "1 kg", price: 34, mrp: 40, category: "Vegetables", etaMinutes: 9, imageEmoji: "🍅", inStock: true },
  { id: "p-paneer", name: "Malai Paneer", brand: "Milky Mist", quantityLabel: "200 g", price: 95, mrp: 105, category: "Dairy", etaMinutes: 9, imageEmoji: "🧀", inStock: true },
  { id: "p-coffee", name: "Instant Coffee Classic", brand: "Nescafé", quantityLabel: "100 g", price: 385, mrp: 410, category: "Beverages", etaMinutes: 9, imageEmoji: "☕", inStock: true },
  { id: "p-chips", name: "Salted Potato Chips", brand: "Lay's", quantityLabel: "115 g", price: 40, mrp: 50, category: "Snacks", etaMinutes: 9, imageEmoji: "🥔", inStock: true },
  { id: "p-atta", name: "Whole Wheat Atta", brand: "Aashirvaad", quantityLabel: "5 kg", price: 285, mrp: 320, category: "Staples", etaMinutes: 11, imageEmoji: "🌾", inStock: true },
  { id: "p-rice", name: "Sona Masoori Rice", brand: "India Gate", quantityLabel: "5 kg", price: 420, mrp: 465, category: "Staples", etaMinutes: 11, imageEmoji: "🍚", inStock: false },
];

export const DINEOUT: DineoutRestaurant[] = [
  { id: "d-toit", name: "Toit Brewpub", cuisines: ["Brewery", "Continental", "Pizza"], rating: 4.7, costForTwo: 1600, area: "Indiranagar", offer: "Flat 15% off total bill", imageEmoji: "🍺" },
  { id: "d-byg", name: "Byg Brewski Brewing Co.", cuisines: ["Brewery", "North Indian", "Asian"], rating: 4.6, costForTwo: 1800, area: "Sarjapur Road", offer: "20% off on walk-in slots", imageEmoji: "🍻" },
  { id: "d-karavalli", name: "Karavalli", cuisines: ["Coastal", "Seafood", "South Indian"], rating: 4.8, costForTwo: 3000, area: "Residency Road", imageEmoji: "🦐" },
  { id: "d-burma", name: "Burma Burma", cuisines: ["Burmese", "Vegetarian"], rating: 4.6, costForTwo: 1500, area: "Indiranagar", offer: "Complimentary dessert", imageEmoji: "🍲" },
  { id: "d-ssb", name: "Sriracha", cuisines: ["Pan Asian", "Thai", "Bar"], rating: 4.4, costForTwo: 2000, area: "MG Road", imageEmoji: "🌶️" },
];
