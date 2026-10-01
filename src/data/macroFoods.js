// Example foods for the TDEE calculator's macro section, grouped by the macro
// each one is mostly known for. Grams per serving, rounded from USDA
// FoodData Central; calories are derived (4/4/9) so they always match the macros.
// Branded items (whey) vary — the values are a typical label.

export const macroFoods = [
  {
    macro: 'protein',
    title: 'Protein',
    foods: [
      { food: 'Chicken breast', serving: '100g cooked', p: 31, c: 0, f: 4 },
      { food: 'Lean beef mince (5% fat)', serving: '100g cooked', p: 26, c: 0, f: 6 },
      { food: 'Tuna, canned in water', serving: '100g drained', p: 26, c: 0, f: 1 },
      { food: 'Salmon', serving: '100g cooked', p: 25, c: 0, f: 8 },
      { food: 'Whey protein', serving: '1 scoop (~30g)', p: 24, c: 2, f: 1.5 },
      { food: 'Tempeh', serving: '100g', p: 20, c: 8, f: 11 },
      { food: 'Greek yogurt, nonfat', serving: '1 cup (170g)', p: 17, c: 6, f: 1 },
      { food: 'Eggs', serving: '1 large', p: 6, c: 0.5, f: 5 },
    ],
  },
  {
    macro: 'carbs',
    title: 'Carbs',
    foods: [
      { food: 'White rice', serving: '1 cup cooked (158g)', p: 4, c: 45, f: 0.5 },
      { food: 'Pasta', serving: '1 cup cooked (140g)', p: 8, c: 43, f: 1 },
      { food: 'Lentils', serving: '1 cup cooked (198g)', p: 18, c: 40, f: 1 },
      { food: 'Potato', serving: '1 medium, baked (173g)', p: 4, c: 37, f: 0 },
      { food: 'Oats', serving: '40g dry', p: 5, c: 27, f: 3 },
      { food: 'Banana', serving: '1 medium (118g)', p: 1, c: 27, f: 0.5 },
      { food: 'Bread (whole wheat)', serving: '2 slices (56g)', p: 7, c: 24, f: 2 },
      { food: 'Blueberries', serving: '1 cup (148g)', p: 1, c: 21, f: 0.5 },
    ],
  },
  {
    macro: 'fat',
    title: 'Fat',
    foods: [
      { food: 'Walnuts', serving: '30g handful', p: 5, c: 4, f: 20 },
      { food: 'Peanut butter', serving: '2 tbsp (32g)', p: 7, c: 7, f: 16 },
      { food: 'Almonds', serving: '30g handful', p: 6, c: 6, f: 15 },
      { food: 'Avocado', serving: '½ medium (100g)', p: 2, c: 9, f: 15 },
      { food: 'Olive oil', serving: '1 tbsp', p: 0, c: 0, f: 14 },
      { food: 'Dark chocolate (70–85%)', serving: '30g', p: 2, c: 14, f: 13 },
      { food: 'Butter', serving: '1 tbsp', p: 0, c: 0, f: 12 },
      { food: 'Cheddar', serving: '30g', p: 7, c: 0, f: 10 },
    ],
  },
]

export const foodKcal = ({ p, c, f }) => Math.round(p * 4 + c * 4 + f * 9)
