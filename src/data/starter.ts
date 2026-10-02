// Starter pack: the 67 Rewe products and 20 recipes from the nutrition plan (values per 100 g or 100 ml, read from the Rewe pages on 2 Oct 2026).
// Loaded into the home's own tables by the button in Meals. Grams are for Jared (j) and Lidia (l).
export type StarterProduct = { key: string; name: string; label: string; pack: string; unit: 'g' | 'ml'; kcal: number; p: number; c: number; f: number; sat: number; fib: number; salt: number; gluten: 'free' | 'contains' | 'unknown'; lactose: 'free' | 'contains' | 'traces' | 'unknown'; note: string }
export type StarterIngredient = { key: string; name: string; unit: 'g' | 'ml'; j: number; l: number }
export type StarterRecipe = { code: string; name: string; slots: ('breakfast' | 'lunch' | 'merienda' | 'dinner')[]; ingredients: StarterIngredient[]; method: string; storage: string }

export const STARTER_PRODUCTS: StarterProduct[] = [
{
"key": "almonds",
"name": "REWE Bio Mandeln 200g",
"label": "Almonds",
"pack": "200g",
"unit": "g",
"kcal": 618.0,
"p": 24.0,
"c": 5.7,
"f": 53.0,
"sat": 4.1,
"fib": 11.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-mandeln-200g/7988732"
},
{
"key": "apple",
"name": "REWE Bio Äpfel rot 1kg",
"label": "Apple",
"pack": "1 kg (Class II)",
"unit": "g",
"kcal": 52.0,
"p": 0.3,
"c": 13.8,
"f": 0.2,
"sat": 0.0,
"fib": 2.4,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-aepfel-rot-1kg/1907545"
},
{
"key": "avocado",
"name": "Avocado Hass vorgereift 1 Stück",
"label": "Avocado flesh",
"pack": "1 piece",
"unit": "g",
"kcal": 160.0,
"p": 2.0,
"c": 8.5,
"f": 14.7,
"sat": 2.1,
"fib": 6.7,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/avocado-hass-essreif-1-stueck/151854"
},
{
"key": "bacon",
"name": "REWE Bio Bacon",
"label": "Bacon",
"pack": "100 g",
"unit": "g",
"kcal": 344.0,
"p": 13.0,
"c": 1.0,
"f": 32.0,
"sat": 13.0,
"fib": 0.0,
"salt": 2.3,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-bacon-100g/7606570"
},
{
"key": "banana",
"name": "Bio Banane ca. 200g (REWE Bio)",
"label": "Banana (peeled)",
"pack": "ca. 200 g (1 piece, weighed)",
"unit": "g",
"kcal": 89.0,
"p": 1.1,
"c": 22.8,
"f": 0.3,
"sat": 0.1,
"fib": 2.6,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/bio-banane-ca-200g/1930502"
},
{
"key": "basmati",
"name": "REWE Beste Wahl Basmati Reis 500g",
"label": "Basmati rice (dry)",
"pack": "500g",
"unit": "g",
"kcal": 356.0,
"p": 8.5,
"c": 78.0,
"f": 0.8,
"sat": 0.2,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-basmati-reis-500g/8886901"
},
{
"key": "beef_mince",
"name": "Wilhelm Brandenburg Mager-Rinderhackfleisch 5% Fett",
"label": "Lean beef mince (5% fat)",
"pack": "ca. 180 g",
"unit": "g",
"kcal": 129.0,
"p": 21.0,
"c": 0.0,
"f": 5.0,
"sat": 2.3,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/wilhelm-brandenburg-mager-rinderhackfleisch-5-fett-ca-180g/1297551"
},
{
"key": "beef_strips",
"name": "REWE Bio Rinderhüftsteak",
"label": "Beef rump steak, sliced",
"pack": "200 g",
"unit": "g",
"kcal": 131.0,
"p": 21.0,
"c": 0.5,
"f": 5.0,
"sat": 2.0,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-rinderhueftsteak-200g/2067251"
},
{
"key": "bell_pepper",
"name": "REWE Bio Paprika rot ca. 200g",
"label": "Red bell pepper",
"pack": "ca. 200 g (1 piece, weighed)",
"unit": "g",
"kcal": 31.0,
"p": 1.0,
"c": 6.0,
"f": 0.3,
"sat": 0.1,
"fib": 2.1,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-paprika-rot-ca-200g/8015318"
},
{
"key": "black_beans",
"name": "REWE Beste Wahl Schwarze Bohnen 400g",
"label": "Black beans (tinned, drained)",
"pack": "400g (drained 265g)",
"unit": "g",
"kcal": 89.0,
"p": 7.3,
"c": 9.5,
"f": 1.2,
"sat": 0.2,
"fib": 5.7,
"salt": 0.3,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-schwarze-bohnen-400g/9518278"
},
{
"key": "blueberries_frozen",
"name": "REWE Beste Wahl Kulturheidelbeeren 500g",
"label": "Blueberries (frozen)",
"pack": "500 g",
"unit": "g",
"kcal": 52.0,
"p": 0.7,
"c": 11.0,
"f": 0.0,
"sat": 0.0,
"fib": 2.4,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-kulturheidelbeeren-500g/7144527"
},
{
"key": "bread_gf",
"name": "Schär Meisterbäckers Mehrkorn Softe Scheiben glutenfrei laktosefrei 330g",
"label": "Gluten-free bread",
"pack": "330g",
"unit": "g",
"kcal": 249.0,
"p": 4.5,
"c": 38.0,
"f": 6.6,
"sat": 0.8,
"fib": 9.9,
"salt": 1.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/schaer-meisterbaeckers-mehrkorn-softe-scheiben-glutenfrei-laktosefrei-330g/7797735"
},
{
"key": "broccoli",
"name": "REWE Bio Broccoli 400g",
"label": "Broccoli",
"pack": "400 g (approx 1 head, Class II)",
"unit": "g",
"kcal": 34.0,
"p": 2.8,
"c": 6.6,
"f": 0.4,
"sat": 0.0,
"fib": 2.6,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-broccoli-400g/2245231"
},
{
"key": "carrot",
"name": "REWE Bio Möhren 1kg",
"label": "Carrots",
"pack": "1 kg (Class I)",
"unit": "g",
"kcal": 41.0,
"p": 0.9,
"c": 9.6,
"f": 0.2,
"sat": 0.0,
"fib": 2.8,
"salt": 0.2,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-moehren-1kg/2588140"
},
{
"key": "cherry_tomato",
"name": "REWE Bio Cherry Romatomaten 250g",
"label": "Cherry tomatoes",
"pack": "250 g (Class II)",
"unit": "g",
"kcal": 18.0,
"p": 0.9,
"c": 3.9,
"f": 0.2,
"sat": 0.0,
"fib": 1.2,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-cherry-romatomaten-250g/2224358"
},
{
"key": "chia",
"name": "REWE Bio Chia-Samen 300g",
"label": "Chia seeds",
"pack": "300g",
"unit": "g",
"kcal": 457.0,
"p": 21.1,
"c": 2.9,
"f": 33.9,
"sat": 3.8,
"fib": 27.7,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-chia-samen-300g/8185452"
},
{
"key": "chicken_breast",
"name": "REWE Bio Hähnchenbrustfilet",
"label": "Chicken breast fillet",
"pack": "ca. 320 g",
"unit": "g",
"kcal": 103.0,
"p": 24.0,
"c": 0.5,
"f": 1.0,
"sat": 0.3,
"fib": 0.0,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-haehnchenbrustfilet-ca-320g/1267719"
},
{
"key": "chicken_thigh",
"name": "Hähnchenoberkeule ohne Haut und Knochen (generic)",
"label": "Chicken thigh, boneless, skinless",
"pack": "",
"unit": "g",
"kcal": 120.0,
"p": 20.0,
"c": 0.0,
"f": 3.8,
"sat": 0.0,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://fddb.info/db/de/lebensmittel/diverse_haehnchenoberkeule_ohne_haut_und_knochen/index.html?nomobile=1"
},
{
"key": "chickpeas",
"name": "REWE Beste Wahl Kichererbsen 140g (vacuum pack, Abtropfgewicht 140 g)",
"label": "Chickpeas (ready-cooked)",
"pack": "140g drained",
"unit": "g",
"kcal": 122.0,
"p": 8.0,
"c": 13.8,
"f": 2.0,
"sat": 0.2,
"fib": 8.2,
"salt": 0.9,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-kichererbsen-140g/7762557"
},
{
"key": "coconut_milk",
"name": "REWE Beste Wahl Kokosmilch cremig 400ml",
"label": "Coconut milk",
"pack": "400ml",
"unit": "ml",
"kcal": 183.0,
"p": 1.5,
"c": 3.1,
"f": 18.0,
"sat": 16.7,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-kokosmilch-cremig-400ml/792132"
},
{
"key": "corn_can",
"name": "REWE Beste Wahl Sonnenmais Supersweet 285g",
"label": "Sweet corn (tinned, drained)",
"pack": "285g",
"unit": "g",
"kcal": 79.0,
"p": 2.6,
"c": 11.5,
"f": 1.8,
"sat": 0.4,
"fib": 3.4,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-sonnenmais-supersweet-285g/7254451"
},
{
"key": "cucumber",
"name": "Salatgurke 1 Stück",
"label": "Cucumber",
"pack": "1 piece",
"unit": "g",
"kcal": 15.0,
"p": 0.7,
"c": 3.6,
"f": 0.1,
"sat": 0.0,
"fib": 0.5,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/salatgurke-1-stueck/483303"
},
{
"key": "cumin",
"name": "Ostmann Kreuzkümmel gemahlen",
"label": "Ground cumin",
"pack": "50 g",
"unit": "g",
"kcal": 429.0,
"p": 17.8,
"c": 34.0,
"f": 22.3,
"sat": 0.1,
"fib": 10.5,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/ostmann-kreuzkuemmel-gemahlen-50g/8018663"
},
{
"key": "curry_powder",
"name": "Ostmann Curry",
"label": "Curry powder",
"pack": "40 g",
"unit": "g",
"kcal": 377.0,
"p": 12.9,
"c": 43.9,
"f": 12.7,
"sat": 1.4,
"fib": 17.6,
"salt": 0.3,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/ostmann-curry-40g/4201981"
},
{
"key": "edamame",
"name": "REWE Bio Edamame ohne Schote",
"label": "Edamame (frozen)",
"pack": "300 g",
"unit": "g",
"kcal": 128.0,
"p": 10.3,
"c": 8.6,
"f": 4.7,
"sat": 2.2,
"fib": 4.8,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-edamame-ohne-schote-300g/8363050"
},
{
"key": "eggs",
"name": "Bio Eier 10 Stück (Bio Naturland)",
"label": "Eggs",
"pack": "10 eggs - class mind. M",
"unit": "g",
"kcal": 153.0,
"p": 13.0,
"c": 0.6,
"f": 11.0,
"sat": 3.1,
"fib": 0.0,
"salt": 0.3,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/bio-eier-10-stueck/7836401"
},
{
"key": "feta",
"name": "REWE Bio Feta g.U.",
"label": "Feta",
"pack": "200g",
"unit": "g",
"kcal": 276.0,
"p": 16.5,
"c": 0.7,
"f": 23.0,
"sat": 17.0,
"fib": 0.0,
"salt": 2.3,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-feta-200g/8960794"
},
{
"key": "granola_gf",
"name": "REWE frei von Bio Hafer Crunchy glutenfrei 400g",
"label": "Gluten-free crunchy granola",
"pack": "400g",
"unit": "g",
"kcal": 438.0,
"p": 9.7,
"c": 64.6,
"f": 14.0,
"sat": 2.0,
"fib": 7.4,
"salt": 0.0,
"gluten": "free",
"lactose": "unknown",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-frei-von-bio-hafer-crunchy-glutenfrei-400g/8983567"
},
{
"key": "green_beans",
"name": "REWE Bio Brechbohnen 450g (tiefgefroren)",
"label": "Green beans",
"pack": "450 g",
"unit": "g",
"kcal": 29.0,
"p": 1.9,
"c": 3.4,
"f": 0.2,
"sat": 0.0,
"fib": 3.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-brechbohnen-450g/742294"
},
{
"key": "ham_turkey",
"name": "Gutfried Putenbrust Natur",
"label": "Turkey breast slices",
"pack": "100 g",
"unit": "g",
"kcal": 96.0,
"p": 19.0,
"c": 0.5,
"f": 2.0,
"sat": 0.6,
"fib": 0.0,
"salt": 2.2,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/gutfried-putenbrust-natur-100g/4676149"
},
{
"key": "honey",
"name": "REWE Bio Blütenhonig 350g",
"label": "Honey",
"pack": "350g",
"unit": "g",
"kcal": 306.0,
"p": 0.4,
"c": 75.0,
"f": 0.5,
"sat": 0.1,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-bluetenhonig-350g/7226966"
},
{
"key": "jasmin",
"name": "REWE Bio Jasminreis weiß 500g",
"label": "Jasmine rice (dry)",
"pack": "500g",
"unit": "g",
"kcal": 346.0,
"p": 6.8,
"c": 77.7,
"f": 0.6,
"sat": 0.1,
"fib": 1.4,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-jasminreis-weiss-500g/8714247"
},
{
"key": "ketchup",
"name": "Heinz Tomato Ketchup",
"label": "Ketchup",
"pack": "400 ml",
"unit": "g",
"kcal": 102.0,
"p": 1.2,
"c": 23.2,
"f": 0.1,
"sat": 0.1,
"fib": 0.0,
"salt": 1.8,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/heinz-tomato-ketchup-400ml/2411634"
},
{
"key": "lemon",
"name": "REWE Bio Zitrone 1 Stück",
"label": "Lemon juice",
"pack": "1 piece (Class I)",
"unit": "g",
"kcal": 29.0,
"p": 1.1,
"c": 9.3,
"f": 0.3,
"sat": 0.0,
"fib": 2.8,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-zitrone-1-stueck/43657"
},
{
"key": "lentils_red",
"name": "Müller's Mühle Rote Linsen 500g",
"label": "Red lentils (dry)",
"pack": "500g",
"unit": "g",
"kcal": 337.0,
"p": 26.0,
"c": 49.0,
"f": 1.4,
"sat": 0.3,
"fib": 12.0,
"salt": 0.0,
"gluten": "unknown",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/mueller-s-muehle-rote-linsen-500g/3577287"
},
{
"key": "lettuce",
"name": "Eisbergsalat 1 Stück",
"label": "Iceberg lettuce",
"pack": "1 head",
"unit": "g",
"kcal": 14.0,
"p": 0.9,
"c": 3.0,
"f": 0.1,
"sat": 0.0,
"fib": 1.2,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/eisbergsalat-1-stueck/482595"
},
{
"key": "magerquark",
"name": "REWE Beste Wahl Speisequark Magerstufe",
"label": "Magerquark",
"pack": "250g",
"unit": "g",
"kcal": 68.0,
"p": 11.8,
"c": 4.0,
"f": 0.3,
"sat": 0.2,
"fib": 0.0,
"salt": 0.1,
"gluten": "free",
"lactose": "traces",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-speisequark-magerstufe-250g/112002"
},
{
"key": "milk_lf",
"name": "REWE Frei von Fettarme H-Milch laktosefrei 1,5%",
"label": "Lactose-free milk",
"pack": "1l",
"unit": "ml",
"kcal": 47.0,
"p": 3.4,
"c": 4.9,
"f": 1.5,
"sat": 1.0,
"fib": 0.0,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-frei-von-fettarme-h-milch-laktosefrei-1-5-1l/1252234"
},
{
"key": "mozzarella",
"name": "REWE Beste Wahl Mozzarella",
"label": "Mozzarella",
"pack": "125g (drained weight, page also shows 200g net fill)",
"unit": "g",
"kcal": 246.0,
"p": 18.9,
"c": 1.0,
"f": 18.5,
"sat": 12.3,
"fib": 0.0,
"salt": 0.6,
"gluten": "free",
"lactose": "traces",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-mozzarella-125g/8698189"
},
{
"key": "mustard",
"name": "Löwensenf Medium",
"label": "Mustard",
"pack": "100 ml",
"unit": "g",
"kcal": 137.0,
"p": 6.8,
"c": 4.8,
"f": 8.2,
"sat": 1.1,
"fib": 0.0,
"salt": 5.2,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/loewensenf-medium-100ml/9668756"
},
{
"key": "oats_gf",
"name": "Bauckhof Bio Haferflocken glutenfrei 475g (page title: Bio Haferflocken Großblatt, glutenfrei)",
"label": "Gluten-free oats",
"pack": "475g",
"unit": "g",
"kcal": 370.0,
"p": 13.0,
"c": 60.0,
"f": 6.7,
"sat": 1.1,
"fib": 9.7,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/bauckhof-bio-haferflocken-glutenfrei-475g/2711183"
},
{
"key": "olive_oil",
"name": "REWE Beste Wahl Natives Olivenöl extra 500ml",
"label": "Olive oil",
"pack": "500ml",
"unit": "g",
"kcal": 900.0,
"p": 0.0,
"c": 0.0,
"f": 100.0,
"sat": 15.2,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-natives-olivenoel-extra-500ml/415263"
},
{
"key": "onion",
"name": "LANDMARKT Zwiebeln gelb 1kg",
"label": "Onion",
"pack": "1 kg (Class I, Germany)",
"unit": "g",
"kcal": 40.0,
"p": 1.1,
"c": 9.3,
"f": 0.1,
"sat": 0.0,
"fib": 1.7,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/landmarkt-zwiebeln-gelb-1kg/9021896"
},
{
"key": "oregano",
"name": "Ostmann Oregano gerebelt",
"label": "Oregano",
"pack": "12.5 g",
"unit": "g",
"kcal": 278.0,
"p": 9.2,
"c": 34.1,
"f": 3.0,
"sat": 1.0,
"fib": 39.0,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/ostmann-oregano-gerebelt-12-5g/4248384"
},
{
"key": "paprika_powder",
"name": "Ostmann Paprika edelsüß",
"label": "Paprika powder",
"pack": "50 g",
"unit": "g",
"kcal": 356.0,
"p": 14.4,
"c": 34.9,
"f": 13.0,
"sat": 2.1,
"fib": 20.9,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/ostmann-paprika-edelsuess-50g/4203585"
},
{
"key": "parmesan",
"name": "Marca Italia Grana Padano gerieben",
"label": "Parmesan / Grana Padano",
"pack": "150g",
"unit": "g",
"kcal": 398.0,
"p": 33.0,
"c": 0.0,
"f": 29.0,
"sat": 18.0,
"fib": 0.0,
"salt": 1.5,
"gluten": "unknown",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/marca-italia-grana-padano-gerieben-150g/8716397"
},
{
"key": "passata",
"name": "REWE Beste Wahl Passierte Tomaten 500g",
"label": "Passata",
"pack": "500 g",
"unit": "g",
"kcal": 28.0,
"p": 1.5,
"c": 4.0,
"f": 0.2,
"sat": 0.1,
"fib": 1.3,
"salt": 0.5,
"gluten": "unknown",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-passierte-tomaten-500g/1060727"
},
{
"key": "pasta_gf",
"name": "Barilla Spaghetti glutenfrei 400g",
"label": "Gluten-free spaghetti (dry)",
"pack": "400g",
"unit": "g",
"kcal": 363.0,
"p": 6.9,
"c": 79.6,
"f": 1.5,
"sat": 0.7,
"fib": 1.7,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/barilla-spaghetti-glutenfrei-400g/2167566"
},
{
"key": "peanut_butter",
"name": "REWE Bio Erdnussmus 250g",
"label": "Peanut butter",
"pack": "250g",
"unit": "g",
"kcal": 593.0,
"p": 25.8,
"c": 7.6,
"f": 49.2,
"sat": 11.0,
"fib": 8.5,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-erdnussmus-250g/9551358"
},
{
"key": "peas_frozen",
"name": "REWE Bio Junge Erbsen tiefgefroren 450g",
"label": "Peas (frozen)",
"pack": "450 g",
"unit": "g",
"kcal": 81.0,
"p": 5.9,
"c": 10.1,
"f": 0.8,
"sat": 0.2,
"fib": 5.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-junge-erbsen-tiefgefroren-450g/2277758"
},
{
"key": "pickles",
"name": "REWE Beste Wahl Burgergurken würzig-süß",
"label": "Burger gherkins",
"pack": "170 g (drained)",
"unit": "g",
"kcal": 44.0,
"p": 0.4,
"c": 9.6,
"f": 0.1,
"sat": 0.1,
"fib": 0.3,
"salt": 0.9,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-burgergurken-wuerzig-suess-170g/7679345"
},
{
"key": "potato",
"name": "Kartoffeln festkochend Drillinge 750g",
"label": "Waxy potatoes",
"pack": "750g",
"unit": "g",
"kcal": 71.0,
"p": 2.0,
"c": 14.6,
"f": 0.1,
"sat": 0.0,
"fib": 2.1,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/kartoffeln-festkochend-drillinge-750g/8668059"
},
{
"key": "quinoa",
"name": "REWE Bio Quinoa Weiß 500g",
"label": "Quinoa (dry)",
"pack": "500g",
"unit": "g",
"kcal": 370.0,
"p": 12.0,
"c": 64.0,
"f": 5.8,
"sat": 0.8,
"fib": 6.8,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-quinoa-weiss-500g/9029547"
},
{
"key": "rice_cakes",
"name": "REWE Bio Reiswaffeln glutenfrei 100g",
"label": "Rice cakes",
"pack": "100g",
"unit": "g",
"kcal": 383.0,
"p": 8.6,
"c": 78.0,
"f": 3.3,
"sat": 0.7,
"fib": 3.5,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-reiswaffeln-glutenfrei-100g/7046256"
},
{
"key": "rice_noodles",
"name": "Fairtrade Original Bio Weiße Reisnudeln 225g",
"label": "Rice noodles (dry)",
"pack": "225g",
"unit": "g",
"kcal": 355.0,
"p": 6.9,
"c": 80.0,
"f": 1.1,
"sat": 0.4,
"fib": 1.3,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/fairtrade-original-bio-weisse-reisnudeln-225g/8039407"
},
{
"key": "rice_vinegar",
"name": "Wan Kwai Reisessig",
"label": "Rice vinegar",
"pack": "250 ml",
"unit": "ml",
"kcal": 3.0,
"p": 0.5,
"c": 0.5,
"f": 0.5,
"sat": 0.0,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/wan-kwai-reisessig-250ml/8946203"
},
{
"key": "salmon_frozen",
"name": "REWE Beste Wahl Norwegisches Lachsfilet ohne Haut",
"label": "Salmon fillet (frozen, thawed)",
"pack": "300 g",
"unit": "g",
"kcal": 196.0,
"p": 19.3,
"c": 0.7,
"f": 12.9,
"sat": 1.9,
"fib": 0.0,
"salt": 0.1,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-norwegisches-lachsfilet-ohne-haut-300g/8314067"
},
{
"key": "salsa",
"name": "REWE Bio Salsa Dip mild vegan",
"label": "Mild salsa",
"pack": "260 g",
"unit": "g",
"kcal": 52.0,
"p": 1.5,
"c": 9.0,
"f": 0.8,
"sat": 0.1,
"fib": 1.5,
"salt": 1.6,
"gluten": "unknown",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-salsa-dip-mild-vegan-260g/9892518"
},
{
"key": "sesame_oil",
"name": "Lien Ying Sesamöl geröstet 100ml",
"label": "Toasted sesame oil",
"pack": "100ml",
"unit": "g",
"kcal": 900.0,
"p": 0.0,
"c": 0.0,
"f": 100.0,
"sat": 16.3,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/lien-ying-sesamoel-geroestet-100ml/4646703"
},
{
"key": "skyr",
"name": "Arla Skyr Natur",
"label": "Skyr natur",
"pack": "450g",
"unit": "g",
"kcal": 63.0,
"p": 11.0,
"c": 4.0,
"f": 0.2,
"sat": 0.1,
"fib": 0.0,
"salt": 0.1,
"gluten": "free",
"lactose": "traces",
"note": "Rewe: https://www.rewe.de/shop/p/arla-skyr-natur-450g/2458768"
},
{
"key": "spinach_frozen",
"name": "Natural Cool Bio Demeter Blattspinat 450g",
"label": "Leaf spinach (frozen)",
"pack": "450 g (20 g portions)",
"unit": "g",
"kcal": 21.0,
"p": 2.8,
"c": 0.6,
"f": 0.3,
"sat": 0.0,
"fib": 2.6,
"salt": 0.2,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/natural-cool-bio-demeter-blattspinat-450g/8937567"
},
{
"key": "sweet_potato",
"name": "Süßkartoffel ca. 500g",
"label": "Sweet potato",
"pack": "ca. 500g",
"unit": "g",
"kcal": 86.0,
"p": 1.6,
"c": 20.0,
"f": 0.1,
"sat": 0.0,
"fib": 0.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/suesskartoffel-ca-500g/475963"
},
{
"key": "tamari",
"name": "Kikkoman Sojasauce Glutenfrei",
"label": "Gluten-free soy sauce",
"pack": "250 ml",
"unit": "ml",
"kcal": 57.0,
"p": 10.0,
"c": 2.0,
"f": 0.0,
"sat": 0.0,
"fib": 0.0,
"salt": 16.4,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/kikkoman-sojasauce-glutenfrei-250ml/1075815"
},
{
"key": "tuna_water",
"name": "REWE Beste Wahl Thunfisch-Filets in eigenem Saft",
"label": "Tuna in own juice (drained)",
"pack": "185 g (130 g drained)",
"unit": "g",
"kcal": 104.0,
"p": 23.0,
"c": 0.0,
"f": 1.3,
"sat": 0.2,
"fib": 0.0,
"salt": 0.5,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-beste-wahl-thunfisch-filets-in-eigenem-saft-130g/1438234"
},
{
"key": "walnuts",
"name": "REWE Bio Walnusskerne 200g",
"label": "Walnuts",
"pack": "200g",
"unit": "g",
"kcal": 708.0,
"p": 16.8,
"c": 5.4,
"f": 67.7,
"sat": 6.7,
"fib": 5.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-walnusskerne-200g/8011859"
},
{
"key": "whey",
"name": "Power System Protein 80 Pulver Vanille glutenfrei",
"label": "Protein powder",
"pack": "360g (serving 30g = about 24 g protein)",
"unit": "g",
"kcal": 366.0,
"p": 80.0,
"c": 6.8,
"f": 1.9,
"sat": 0.8,
"fib": 0.0,
"salt": 1.4,
"gluten": "free",
"lactose": "contains",
"note": "Rewe: https://www.rewe.de/shop/p/power-system-protein-80-pulver-vanille-glutenfrei-360g/8780124"
},
{
"key": "zucchini",
"name": "REWE Bio Zucchini 500g",
"label": "Zucchini",
"pack": "500 g (Class II)",
"unit": "g",
"kcal": 17.0,
"p": 1.2,
"c": 3.1,
"f": 0.3,
"sat": 0.1,
"fib": 1.0,
"salt": 0.0,
"gluten": "free",
"lactose": "free",
"note": "Rewe: https://www.rewe.de/shop/p/rewe-bio-zucchini-500g/2577507"
}
]

export const STARTER_RECIPES: StarterRecipe[] = [
{
"code": "B1",
"name": "Berry-banana protein porridge",
"slots": [
"breakfast"
],
"ingredients": [
{
"key": "oats_gf",
"name": "Gluten-free oats",
"unit": "g",
"j": 75,
"l": 60
},
{
"key": "milk_lf",
"name": "Lactose-free milk",
"unit": "ml",
"j": 200,
"l": 160
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "banana",
"name": "Banana (peeled)",
"unit": "g",
"j": 110,
"l": 85
},
{
"key": "blueberries_frozen",
"name": "Blueberries (frozen)",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "chia",
"name": "Chia seeds",
"unit": "g",
"j": 8,
"l": 6
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 12,
"l": 9
},
{
"key": "peanut_butter",
"name": "Peanut butter",
"unit": "g",
"j": 10,
"l": 8
}
],
"method": "Simmer the oats with the milk for 4 to 5 minutes, stirring, until thick. Take off the heat, stir in the chia and skyr, then top with the banana, defrosted blueberries, honey and peanut butter.",
"storage": "Cook 2 portions at once and keep the porridge (without toppings) in the fridge for 1 day; add skyr and fruit fresh."
},
{
"code": "B2",
"name": "Skyr crunch bowl",
"slots": [
"breakfast"
],
"ingredients": [
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 180,
"l": 140
},
{
"key": "granola_gf",
"name": "Gluten-free crunchy granola",
"unit": "g",
"j": 45,
"l": 35
},
{
"key": "banana",
"name": "Banana (peeled)",
"unit": "g",
"j": 110,
"l": 85
},
{
"key": "blueberries_frozen",
"name": "Blueberries (frozen)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "walnuts",
"name": "Walnuts",
"unit": "g",
"j": 15,
"l": 12
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 12,
"l": 9
},
{
"key": "chia",
"name": "Chia seeds",
"unit": "g",
"j": 8,
"l": 6
}
],
"method": "Spoon the skyr into a bowl, add sliced banana and defrosted blueberries, then chia, walnuts and honey. Put the granola on last so it stays crunchy. Five minutes, no cooking.",
"storage": "Prepare nothing ahead except defrosting the blueberries in the fridge overnight."
},
{
"code": "B3",
"name": "Eggs, avocado and toast",
"slots": [
"breakfast"
],
"ingredients": [
{
"key": "eggs",
"name": "Eggs",
"unit": "g",
"j": 100,
"l": 75
},
{
"key": "avocado",
"name": "Avocado flesh",
"unit": "g",
"j": 50,
"l": 40
},
{
"key": "bread_gf",
"name": "Gluten-free bread",
"unit": "g",
"j": 82,
"l": 65
},
{
"key": "cherry_tomato",
"name": "Cherry tomatoes",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 4,
"l": 3
},
{
"key": "bacon",
"name": "Bacon",
"unit": "g",
"j": 15,
"l": 12
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "banana",
"name": "Banana (peeled)",
"unit": "g",
"j": 110,
"l": 85
}
],
"method": "Fry the bacon until crisp, then scramble or fry the eggs in the oil. Toast the gluten-free bread, mash the avocado on it and add the tomatoes. Eat the skyr and banana on the side. Jared has 2 eggs, Lidia 1 and a half (crack an extra egg and share it).",
"storage": "Cook it fresh, it takes 10 minutes."
},
{
"code": "M1",
"name": "Recovery shake",
"slots": [
"merienda"
],
"ingredients": [
{
"key": "whey",
"name": "Protein powder",
"unit": "g",
"j": 20,
"l": 16
},
{
"key": "milk_lf",
"name": "Lactose-free milk",
"unit": "ml",
"j": 300,
"l": 235
},
{
"key": "banana",
"name": "Banana (peeled)",
"unit": "g",
"j": 110,
"l": 85
},
{
"key": "oats_gf",
"name": "Gluten-free oats",
"unit": "g",
"j": 35,
"l": 30
},
{
"key": "peanut_butter",
"name": "Peanut butter",
"unit": "g",
"j": 10,
"l": 8
}
],
"method": "Blend everything for 30 seconds. Take it to the gym in a bottle and drink within 1 hour of training. The oats make it thick and slow, so it also works as a small meal.",
"storage": "Blend fresh. If you carry it, keep it cold and drink it the same day."
},
{
"code": "M2",
"name": "Quark-berry-almond cup",
"slots": [
"merienda"
],
"ingredients": [
{
"key": "magerquark",
"name": "Magerquark",
"unit": "g",
"j": 150,
"l": 120
},
{
"key": "blueberries_frozen",
"name": "Blueberries (frozen)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 15,
"l": 12
},
{
"key": "almonds",
"name": "Almonds",
"unit": "g",
"j": 20,
"l": 16
},
{
"key": "granola_gf",
"name": "Gluten-free crunchy granola",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "banana",
"name": "Banana (peeled)",
"unit": "g",
"j": 80,
"l": 65
}
],
"method": "Mix the quark with the honey, layer with the blueberries and sliced banana, and top with almonds and granola.",
"storage": "Fill the cups the evening before (granola on top just before eating). Fridge, 1 day."
},
{
"code": "M3",
"name": "Snack plate",
"slots": [
"merienda"
],
"ingredients": [
{
"key": "eggs",
"name": "Eggs",
"unit": "g",
"j": 100,
"l": 75
},
{
"key": "ham_turkey",
"name": "Turkey breast slices",
"unit": "g",
"j": 50,
"l": 40
},
{
"key": "rice_cakes",
"name": "Rice cakes",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "cherry_tomato",
"name": "Cherry tomatoes",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "apple",
"name": "Apple",
"unit": "g",
"j": 150,
"l": 120
},
{
"key": "peanut_butter",
"name": "Peanut butter",
"unit": "g",
"j": 10,
"l": 8
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 8,
"l": 6
}
],
"method": "Boil the eggs for 9 minutes and cool them in cold water. Build a plate with the eggs, turkey rolled around the rice cakes, tomatoes and apple, and spread the peanut butter and honey on a rice cake or the apple.",
"storage": "Boil the eggs for the week on Sunday (up to 5 days in the fridge, unpeeled)."
},
{
"code": "L1",
"name": "Teriyaki-style chicken, rice and broccoli",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "chicken_breast",
"name": "Chicken breast fillet",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 125,
"l": 100
},
{
"key": "broccoli",
"name": "Broccoli",
"unit": "g",
"j": 200,
"l": 160
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 8,
"l": 6
},
{
"key": "carrot",
"name": "Carrots",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "tamari",
"name": "Gluten-free soy sauce",
"unit": "ml",
"j": 12,
"l": 9
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 10,
"l": 8
},
{
"key": "rice_vinegar",
"name": "Rice vinegar",
"unit": "ml",
"j": 5,
"l": 4
},
{
"key": "sesame_oil",
"name": "Toasted sesame oil",
"unit": "g",
"j": 4,
"l": 3
}
],
"method": "Cook the rice. Pan-fry the chicken cut into strips in the oil for 6 to 7 minutes, add the broccoli and carrot with a splash of water, and cover for 4 minutes. Stir the sauce into the pan for the last minute. Sauce D2 (honey-soy-sesame glaze): whisk the soy sauce, honey, rice vinegar and sesame oil. It is already in the grams above.",
"storage": "Fridge 2 days. Freeze the portion you eat on day 3 (it thaws overnight in the fridge). Reheat until steaming hot (above 70 °C)."
},
{
"code": "L2",
"name": "Greek chicken thigh traybake",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "chicken_thigh",
"name": "Chicken thigh, boneless, skinless",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "potato",
"name": "Waxy potatoes",
"unit": "g",
"j": 400,
"l": 315
},
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 45,
"l": 35
},
{
"key": "zucchini",
"name": "Zucchini",
"unit": "g",
"j": 150,
"l": 120
},
{
"key": "bell_pepper",
"name": "Red bell pepper",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 16,
"l": 13
},
{
"key": "oregano",
"name": "Oregano",
"unit": "g",
"j": 1,
"l": 1
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "cucumber",
"name": "Cucumber",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "lemon",
"name": "Lemon juice",
"unit": "g",
"j": 5,
"l": 4
}
],
"method": "Cut the potatoes, zucchini and pepper into chunks, toss with the oil and oregano and spread on a tray with the chicken thighs. Roast at 200 °C for 35 to 40 minutes. Cook the rice, stir the skyr, cucumber and lemon into a sauce and spoon it over. Sauce D1 (lemon skyr \"tzatziki\"): stir the skyr, grated cucumber and lemon together with a little oil, garlic powder and dill. It is already in the grams above.",
"storage": "Fridge 2 days. The traybake keeps better than most: reheat in the oven or a pan so the potatoes do not go soggy."
},
{
"code": "L3",
"name": "Salmon, baby potatoes and green beans",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "salmon_frozen",
"name": "Salmon fillet (frozen, thawed)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "potato",
"name": "Waxy potatoes",
"unit": "g",
"j": 445,
"l": 350
},
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 35,
"l": 30
},
{
"key": "green_beans",
"name": "Green beans",
"unit": "g",
"j": 150,
"l": 120
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 9,
"l": 7
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "cucumber",
"name": "Cucumber",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "lemon",
"name": "Lemon juice",
"unit": "g",
"j": 5,
"l": 4
}
],
"method": "Boil the potatoes for 15 minutes, add the green beans for the last 5. Season the thawed salmon, bake at 200 °C for 12 to 14 minutes or pan-fry skin side down. Serve with the skyr sauce and a little rice if you like. Sauce D1 (lemon skyr \"tzatziki\"): stir the skyr, grated cucumber and lemon together with a little oil, garlic powder and dill. It is already in the grams above.",
"storage": "Eat salmon first: it is the meal for the first two days after cooking. Fridge 2 days at most. Reheat gently (microwave on 50 %) so it does not dry out."
},
{
"code": "L4",
"name": "Mild beef chilli with rice",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "beef_mince",
"name": "Lean beef mince (5% fat)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "black_beans",
"name": "Black beans (tinned, drained)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "corn_can",
"name": "Sweet corn (tinned, drained)",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "passata",
"name": "Passata",
"unit": "g",
"j": 200,
"l": 160
},
{
"key": "onion",
"name": "Onion",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "bell_pepper",
"name": "Red bell pepper",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 95,
"l": 75
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 6,
"l": 5
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "avocado",
"name": "Avocado flesh",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "paprika_powder",
"name": "Paprika powder",
"unit": "g",
"j": 3,
"l": 2
},
{
"key": "cumin",
"name": "Ground cumin",
"unit": "g",
"j": 1,
"l": 1
}
],
"method": "Brown the mince with the onion and pepper in the oil. Add the spices, passata, beans and corn and simmer for 20 minutes. Serve over rice with the skyr and avocado on top.",
"storage": "Fridge 3 days, or freeze (chilli freezes very well). Keep the rice separate if you can."
},
{
"code": "L5",
"name": "Beef meatballs, tomato sauce and gluten-free pasta",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "beef_mince",
"name": "Lean beef mince (5% fat)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "eggs",
"name": "Eggs",
"unit": "g",
"j": 25,
"l": 25
},
{
"key": "pasta_gf",
"name": "Gluten-free spaghetti (dry)",
"unit": "g",
"j": 120,
"l": 95
},
{
"key": "passata",
"name": "Passata",
"unit": "g",
"j": 220,
"l": 175
},
{
"key": "zucchini",
"name": "Zucchini",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 8,
"l": 6
},
{
"key": "parmesan",
"name": "Parmesan / Grana Padano",
"unit": "g",
"j": 10,
"l": 8
},
{
"key": "oregano",
"name": "Oregano",
"unit": "g",
"j": 1,
"l": 1
}
],
"method": "Mix the mince with the egg, parmesan and oregano, roll into balls and bake at 200 °C for 15 minutes. Simmer the passata with the grated zucchini for 15 minutes, add the meatballs. Cook the gluten-free pasta for 1 minute less than the pack says, as it softens when reheated.",
"storage": "Fridge 3 days. Toss pasta and sauce together before storing so the pasta does not stick."
},
{
"code": "L6",
"name": "Coconut chicken curry with jasmine rice",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "chicken_breast",
"name": "Chicken breast fillet",
"unit": "g",
"j": 115,
"l": 90
},
{
"key": "coconut_milk",
"name": "Coconut milk",
"unit": "ml",
"j": 100,
"l": 80
},
{
"key": "curry_powder",
"name": "Curry powder",
"unit": "g",
"j": 4,
"l": 3
},
{
"key": "onion",
"name": "Onion",
"unit": "g",
"j": 50,
"l": 40
},
{
"key": "bell_pepper",
"name": "Red bell pepper",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "spinach_frozen",
"name": "Leaf spinach (frozen)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "jasmin",
"name": "Jasmine rice (dry)",
"unit": "g",
"j": 105,
"l": 85
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 6,
"l": 5
}
],
"method": "Fry the onion, pepper and chicken pieces in the oil. Add the curry powder, then the coconut milk and 100 ml of water, and simmer for 10 minutes. Stir in the spinach at the end. Serve over the jasmine rice.",
"storage": "Fridge 2 days; freeze the day-3 portion. Reheat until steaming hot."
},
{
"code": "L7",
"name": "Beef and broccoli stir-fry with rice noodles",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "beef_strips",
"name": "Beef rump steak, sliced",
"unit": "g",
"j": 125,
"l": 100
},
{
"key": "rice_noodles",
"name": "Rice noodles (dry)",
"unit": "g",
"j": 110,
"l": 85
},
{
"key": "broccoli",
"name": "Broccoli",
"unit": "g",
"j": 150,
"l": 120
},
{
"key": "carrot",
"name": "Carrots",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "bell_pepper",
"name": "Red bell pepper",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 8,
"l": 6
},
{
"key": "tamari",
"name": "Gluten-free soy sauce",
"unit": "ml",
"j": 12,
"l": 9
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 10,
"l": 8
},
{
"key": "rice_vinegar",
"name": "Rice vinegar",
"unit": "ml",
"j": 5,
"l": 4
},
{
"key": "sesame_oil",
"name": "Toasted sesame oil",
"unit": "g",
"j": 4,
"l": 3
}
],
"method": "Soak or boil the rice noodles as the pack says and drain. Stir-fry the beef strips fast in a hot pan with half the oil (2 minutes), set aside. Stir-fry the broccoli, carrot and pepper for 5 minutes, add the noodles and beef and pour in the sauce. Sauce D2 (honey-soy-sesame glaze): whisk the soy sauce, honey, rice vinegar and sesame oil. It is already in the grams above.",
"storage": "Fridge 3 days. Add a splash of water when reheating, noodles dry out."
},
{
"code": "L8",
"name": "Egg-fried rice (takeaway swap)",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 115,
"l": 90
},
{
"key": "eggs",
"name": "Eggs",
"unit": "g",
"j": 100,
"l": 75
},
{
"key": "chicken_breast",
"name": "Chicken breast fillet",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "peas_frozen",
"name": "Peas (frozen)",
"unit": "g",
"j": 70,
"l": 55
},
{
"key": "carrot",
"name": "Carrots",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "tamari",
"name": "Gluten-free soy sauce",
"unit": "ml",
"j": 12,
"l": 9
},
{
"key": "sesame_oil",
"name": "Toasted sesame oil",
"unit": "g",
"j": 6,
"l": 5
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 6,
"l": 5
}
],
"method": "Cook the rice the day before and chill it, or use freshly cooked rice spread on a tray to cool. Scramble the eggs in a hot pan, add the chicken strips and vegetables, then the rice, the soy sauce and the sesame oil. Fry for 5 minutes until hot and slightly crisp. This is the home version of your Chinese takeaway, without wheat.",
"storage": "Cook it fresh on the day. Do not keep leftovers of fried rice."
},
{
"code": "L9",
"name": "Burger bowl (Five Guys at home)",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "beef_mince",
"name": "Lean beef mince (5% fat)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "lettuce",
"name": "Iceberg lettuce",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "cherry_tomato",
"name": "Cherry tomatoes",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "pickles",
"name": "Burger gherkins",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "mozzarella",
"name": "Mozzarella",
"unit": "g",
"j": 25,
"l": 20
},
{
"key": "potato",
"name": "Waxy potatoes",
"unit": "g",
"j": 500,
"l": 395
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 10,
"l": 8
},
{
"key": "avocado",
"name": "Avocado flesh",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "ketchup",
"name": "Ketchup",
"unit": "g",
"j": 15,
"l": 12
},
{
"key": "mustard",
"name": "Mustard",
"unit": "g",
"j": 5,
"l": 4
}
],
"method": "Cut the potatoes into wedges, toss in the oil and bake at 220 °C for 35 minutes. Shape the mince into 2 patties, fry them for 3 minutes per side and melt the mozzarella on top. Chop the lettuce, tomato and pickles into a bowl, add the patty, avocado and fries and spoon the sauce over. Sauce D4 (burger sauce): mix the skyr, ketchup, mustard and chopped gherkins. It is already in the grams above.",
"storage": "Fridge 2 days. Re-crisp the potatoes in a pan or oven. Keep the lettuce raw in a separate box."
},
{
"code": "L10",
"name": "Tuna, chickpea and quinoa salad",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "tuna_water",
"name": "Tuna in own juice (drained)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "quinoa",
"name": "Quinoa (dry)",
"unit": "g",
"j": 95,
"l": 75
},
{
"key": "chickpeas",
"name": "Chickpeas (ready-cooked)",
"unit": "g",
"j": 140,
"l": 110
},
{
"key": "cucumber",
"name": "Cucumber",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "cherry_tomato",
"name": "Cherry tomatoes",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "feta",
"name": "Feta",
"unit": "g",
"j": 25,
"l": 20
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 12,
"l": 9
},
{
"key": "mustard",
"name": "Mustard",
"unit": "g",
"j": 5,
"l": 4
},
{
"key": "lemon",
"name": "Lemon juice",
"unit": "g",
"j": 8,
"l": 6
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 3,
"l": 2
}
],
"method": "Cook the quinoa as on the pack and let it cool. Mix with the tuna, chickpeas, chopped cucumber and tomatoes, crumble over the feta and dress with the vinaigrette. Sauce D3 (lemon-mustard vinaigrette): shake the oil, mustard, lemon juice and honey in a jar. It is already in the grams above.",
"storage": "Fridge 3 days, no reheating needed. It is the easiest packed lunch of the plan."
},
{
"code": "L11",
"name": "Lentil-beef bolognese with gluten-free pasta",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "beef_mince",
"name": "Lean beef mince (5% fat)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "lentils_red",
"name": "Red lentils (dry)",
"unit": "g",
"j": 30,
"l": 25
},
{
"key": "passata",
"name": "Passata",
"unit": "g",
"j": 200,
"l": 160
},
{
"key": "carrot",
"name": "Carrots",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "onion",
"name": "Onion",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "pasta_gf",
"name": "Gluten-free spaghetti (dry)",
"unit": "g",
"j": 105,
"l": 85
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 8,
"l": 6
},
{
"key": "parmesan",
"name": "Parmesan / Grana Padano",
"unit": "g",
"j": 8,
"l": 6
}
],
"method": "Soften the onion and carrot in the oil, brown the mince, add the lentils, passata and 150 ml of water and simmer for 25 minutes. Cook the gluten-free pasta a minute short, toss it with the sauce and add the parmesan.",
"storage": "Fridge 3 days, or freeze. The red lentils melt into the sauce, so nobody notices them."
},
{
"code": "L12",
"name": "Salmon poke-style bowl",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "salmon_frozen",
"name": "Salmon fillet (frozen, thawed)",
"unit": "g",
"j": 120,
"l": 95
},
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 90,
"l": 70
},
{
"key": "edamame",
"name": "Edamame (frozen)",
"unit": "g",
"j": 70,
"l": 55
},
{
"key": "avocado",
"name": "Avocado flesh",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "cucumber",
"name": "Cucumber",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "carrot",
"name": "Carrots",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "tamari",
"name": "Gluten-free soy sauce",
"unit": "ml",
"j": 12,
"l": 9
},
{
"key": "honey",
"name": "Honey",
"unit": "g",
"j": 10,
"l": 8
},
{
"key": "rice_vinegar",
"name": "Rice vinegar",
"unit": "ml",
"j": 5,
"l": 4
},
{
"key": "sesame_oil",
"name": "Toasted sesame oil",
"unit": "g",
"j": 4,
"l": 3
}
],
"method": "Cook the rice and let it cool a little. Bake or pan-fry the salmon for 10 minutes and flake it. Boil the edamame for 3 minutes. Put rice in a bowl, add the salmon, edamame, avocado, cucumber and carrot, and spoon over the glaze. Sauce D2 (honey-soy-sesame glaze): whisk the soy sauce, honey, rice vinegar and sesame oil. It is already in the grams above.",
"storage": "Salmon day: eat within 2 days. Cool the rice quickly. Fridge 2 days at most."
},
{
"code": "L13",
"name": "Greek chicken bowl",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "chicken_breast",
"name": "Chicken breast fillet",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "basmati",
"name": "Basmati rice (dry)",
"unit": "g",
"j": 125,
"l": 100
},
{
"key": "cucumber",
"name": "Cucumber",
"unit": "g",
"j": 110,
"l": 85
},
{
"key": "cherry_tomato",
"name": "Cherry tomatoes",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "feta",
"name": "Feta",
"unit": "g",
"j": 25,
"l": 20
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 12,
"l": 9
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 60,
"l": 45
},
{
"key": "lemon",
"name": "Lemon juice",
"unit": "g",
"j": 5,
"l": 4
}
],
"method": "Cook the rice. Fry the chicken, cut into cubes, in the oil with a pinch of oregano for 7 minutes. Put rice, chicken, chopped cucumber and tomatoes in a bowl, crumble over the feta and add the skyr sauce. Sauce D1 (lemon skyr \"tzatziki\"): stir the skyr, grated cucumber and lemon together with a little oil, garlic powder and dill. It is already in the grams above.",
"storage": "Fridge 2 days; freeze the day-3 portion. Keep the sauce in a small box."
},
{
"code": "L14",
"name": "Chicken, sweet potato and black bean bowl",
"slots": [
"lunch",
"dinner"
],
"ingredients": [
{
"key": "chicken_thigh",
"name": "Chicken thigh, boneless, skinless",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "sweet_potato",
"name": "Sweet potato",
"unit": "g",
"j": 420,
"l": 330
},
{
"key": "black_beans",
"name": "Black beans (tinned, drained)",
"unit": "g",
"j": 100,
"l": 80
},
{
"key": "corn_can",
"name": "Sweet corn (tinned, drained)",
"unit": "g",
"j": 80,
"l": 65
},
{
"key": "salsa",
"name": "Mild salsa",
"unit": "g",
"j": 50,
"l": 40
},
{
"key": "avocado",
"name": "Avocado flesh",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "skyr",
"name": "Skyr natur",
"unit": "g",
"j": 40,
"l": 30
},
{
"key": "olive_oil",
"name": "Olive oil",
"unit": "g",
"j": 6,
"l": 5
},
{
"key": "cumin",
"name": "Ground cumin",
"unit": "g",
"j": 1,
"l": 1
},
{
"key": "paprika_powder",
"name": "Paprika powder",
"unit": "g",
"j": 2,
"l": 2
}
],
"method": "Bake the sweet potato cubes with the oil, cumin and paprika at 200 °C for 30 minutes. Fry the chicken thighs in a pan for 7 to 8 minutes per side. Warm the beans and corn, then build the bowl and top with salsa, avocado and skyr.",
"storage": "Cook it fresh on the day, it is the Saturday meal."
}
]

// The week schedule (Sunday to Saturday) of the nutrition plan. Codes point to the recipes above.
export type WeekDay = { breakfast: string | null; lunch: string | null; merienda: string | null; dinner: string | null }
const B = ['B3', 'B1', 'B2', 'B1', 'B2', 'B1', 'B3']
const M = ['M3', 'M1', 'M1', 'M2', 'M1', 'M1', 'M2']
const build = (lunch: (string | null)[], dinner: string[]): WeekDay[] => B.map((b, i) => ({ breakfast: b, lunch: lunch[i], merienda: M[i], dinner: dinner[i] }))
export const WEEK_PLANS: Record<'A' | 'B', WeekDay[]> = {
  A: build([null, 'L3', 'L4', 'L1', 'L9', 'L6', 'L11'], ['L3', 'L4', 'L1', 'L9', 'L6', 'L11', 'L8']),
  B: build([null, 'L12', 'L5', 'L13', 'L10', 'L7', 'L2'], ['L12', 'L5', 'L13', 'L10', 'L7', 'L2', 'L14']),
}
