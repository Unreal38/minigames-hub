// Polish names for everything in the Wardrobe: avatar options (avatar.js) and account cosmetics (cosmetics.js).
// Those two files load this only when the site is in Polish and swap the names in place, so every screen that shows
// an item name gets the Polish one. Names are matched by their English text, per list: a new item with no entry here
// simply keeps its English name, so add the Polish name here when you add an item there.
// It must not import avatar.js or cosmetics.js (they wait for this file).

const NONE = 'Brak';
export const OPT_PL = {
  body: { Slim: 'Szczupła', Average: 'Przeciętna', Athletic: 'Wysportowana', Broad: 'Barczysta', Curvy: 'Krągła', Sturdy: 'Krępa' },
  height: { Short: 'Niski', Medium: 'Średni', Tall: 'Wysoki' },
  face: { Round: 'Okrągła', Oval: 'Owalna', Square: 'Kwadratowa', Heart: 'Serce', Long: 'Pociągła' },
  eyes: { Round: 'Okrągłe', Almond: 'Migdałowe', Narrow: 'Wąskie', Wide: 'Szerokie', Sleepy: 'Senne', Sparkle: 'Błyszczące', Droopy: 'Opadające', Dot: 'Kropki', Happy: 'Wesołe',
    Cat: 'Kocie', Lashes: 'Z rzęsami', Wink: 'Oczko', Hearts: 'Serduszka', Spiral: 'Spirale', 'Closed X': 'Iksy', Starry: 'Gwiaździste' },
  brows: { Straight: 'Proste', Arched: 'Łukowate', Thick: 'Grube', Thin: 'Cienkie', Angled: 'Skośne', Soft: 'Łagodne', None: NONE },
  nose: { Button: 'Guziczek', Pointed: 'Spiczasty', Wide: 'Szeroki', Long: 'Długi', Snub: 'Zadarty' },
  mouth: { Smile: 'Uśmiech', Grin: 'Szeroki uśmiech', Flat: 'Prosta kreska', Open: 'Otwarte', Smirk: 'Uśmieszek', Pout: 'Dzióbek', Cat: 'Kocie', Fangs: 'Kły', 'Tongue out': 'Język na wierzchu', Wavy: 'Faliste' },
  marks: { None: NONE, Freckles: 'Piegi', Blush: 'Rumieńce', Mole: 'Pieprzyk', 'Star sticker': 'Naklejka-gwiazdka', 'Heart cheeks': 'Serduszka na policzkach', Bandage: 'Plaster', Whiskers: 'Wąsiki' },
  hair: { Bun: 'Kok', Short: 'Krótkie', Pigtails: 'Kitki', Spiky: 'Na jeża', Long: 'Długie', Bald: 'Łysina', Bob: 'Bob', Ponytail: 'Kucyk', Curly: 'Kręcone', Mohawk: 'Irokez', Buzz: 'Na zapałkę',
    'Side part': 'Z przedziałkiem', Quiff: 'Czub', Afro: 'Afro', Braids: 'Warkocze', Wavy: 'Falowane' },
  facial: { None: NONE, Stubble: 'Zarost', Mustache: 'Wąsy', Goatee: 'Kozia bródka', 'Full beard': 'Pełna broda', 'Chin strap': 'Broda po linii szczęki', Handlebar: 'Podkręcone wąsy' },
  top: { 'T-shirt': 'T-shirt', Hoodie: 'Bluza z kapturem', Jacket: 'Kurtka', Sweater: 'Sweter', 'Striped tee': 'Koszulka w paski', 'Tank top': 'Top na ramiączkach', Dress: 'Sukienka', Apron: 'Fartuch',
    Overalls: 'Ogrodniczki', Suit: 'Garnitur', 'Sailor top': 'Bluzka marynarska', Cardigan: 'Kardigan', Turtleneck: 'Golf', Polo: 'Polo', 'Varsity jacket': 'Kurtka uniwersytecka', Kimono: 'Kimono',
    'Puffer vest': 'Pikowana kamizelka', Jersey: 'Koszulka sportowa', 'Flower shirt': 'Koszula w kwiaty', Tuxedo: 'Smoking', 'Hero suit': 'Strój bohatera', 'Knight armour': 'Zbroja rycerza',
    'Space suit': 'Skafander', 'Dino onesie': 'Kombinezon dinozaura', 'Llama onesie': 'Kombinezon lamy', 'Banana suit': 'Strój banana', 'Ghost sheet': 'Prześcieradło ducha', 'Bee costume': 'Strój pszczoły', 'Ugly sweater': 'Brzydki sweter',
    'Bear hoodie': 'Bluza misia', 'Skeleton suit': 'Strój kościotrupa', 'Duck floatie': 'Kółko-kaczka', 'Barista sweater': 'Sweter baristy',
    'Ball gown': 'Suknia balowa', 'Royal robe': 'Królewska szata', 'Pirate coat': 'Płaszcz pirata', 'Leather jacket': 'Skórzana kurtka', 'Tracksuit top': 'Bluza dresowa', 'Sequin top': 'Bluzka z cekinami' },
  bottom: { Trousers: 'Spodnie', Jeans: 'Dżinsy', Shorts: 'Szorty', Skirt: 'Spódnica', Joggers: 'Dresy', 'Pleated skirt': 'Plisowana spódnica', 'Long skirt': 'Długa spódnica', Leggings: 'Legginsy', 'Wide trousers': 'Szerokie spodnie', 'Cuffed trousers': 'Spodnie z mankietami', 'Cargo trousers': 'Bojówki', Tutu: 'Tutu', 'Plaid kilt': 'Kilt w kratę', 'Swim shorts': 'Kąpielówki', 'Flared trousers': 'Dzwony', 'Ripped jeans': 'Dżinsy z dziurami', 'Track trousers': 'Spodnie dresowe' },
  shoes: { Sneakers: 'Trampki', Boots: 'Buty za kostkę', Sandals: 'Sandały', 'High tops': 'Wysokie trampki', Loafers: 'Mokasyny', 'Bunny slippers': 'Kapcie-króliczki', 'Rain boots': 'Kalosze', 'Roller skates': 'Wrotki', 'Cocoa slippers': 'Kapcie-kakao', 'Paw slippers': 'Kapcie-łapki', 'Light-up sneakers': 'Świecące trampki', Flippers: 'Płetwy', 'Ice skates': 'Łyżwy', Heels: 'Szpilki', 'Cowboy boots': 'Kowbojki', 'Platform boots': 'Buty na platformie' },
  hat: { None: NONE, Beanie: 'Czapka', Cap: 'Czapka z daszkiem', 'Chef hat': 'Czapka kucharska', Crown: 'Korona', 'Cat ears': 'Kocie uszy', Headphones: 'Słuchawki', Flower: 'Kwiat', Bow: 'Kokarda',
    'Bucket hat': 'Kapelusz rybacki', Beret: 'Beret', 'Straw hat': 'Słomkowy kapelusz', 'Bunny ears': 'Królicze uszy', 'Witch hat': 'Kapelusz czarownicy', 'Top hat': 'Cylinder', 'Party hat': 'Czapeczka urodzinowa',
    'Pirate hat': 'Kapelusz pirata', 'Viking helmet': 'Hełm wikinga', Halo: 'Aureola', 'Propeller cap': 'Czapka ze śmigiełkiem', 'Frog hat': 'Żabia czapka', 'Santa hat': 'Czapka Mikołaja',
    'Wizard hat': 'Kapelusz czarodzieja', 'Flower crown': 'Wianek', 'Devil horns': 'Diabelskie rogi', Antennae: 'Czułki', 'Cowboy hat': 'Kapelusz kowbojski', 'Mushroom cap': 'Kapelusz grzyba',
    'Unicorn horn': 'Róg jednorożca', 'Traffic cone': 'Pachołek drogowy', 'Frog bucket hat': 'Żabi kapelusz rybacki', 'Giant headphones': 'Wielkie słuchawki', 'Astronaut helmet': 'Hełm astronauty',
    'Knight helmet': 'Hełm rycerza', 'Rubber duck': 'Gumowa kaczka', 'Cheese wedge': 'Kawałek sera', 'Pumpkin head': 'Dyniowa głowa', 'Reindeer antlers': 'Poroże renifera', Earmuffs: 'Nauszniki',
    'Pineapple hat': 'Ananasowy kapelusz', 'Tulip hat': 'Tulipanowy kapelusz', 'Coffee mug hat': 'Czapka-kubek', Sprout: 'Kiełek', 'Candle flame': 'Płomień świecy', 'Wave curl': 'Grzywa fali', 'Storm cloud': 'Burzowa chmurka', Tiara: 'Tiara', Veil: 'Welon', Sweatband: 'Frotka na czoło', Deerstalker: 'Czapka detektywa' },
  glasses: { None: NONE, Glasses: 'Okulary', 'Round glasses': 'Okrągłe okulary', Sunglasses: 'Okulary przeciwsłoneczne', 'Star glasses': 'Okulary-gwiazdki', 'Heart glasses': 'Okulary-serduszka', Monocle: 'Monokl',
    'Eye patch': 'Opaska na oko', Goggles: 'Gogle', '3D glasses': 'Okulary 3D', 'Clown nose': 'Nos klauna', 'Snorkel mask': 'Maska do nurkowania', 'Café glasses': 'Kawiarniane okulary', 'Masquerade mask': 'Maska balowa', 'Cat-eye glasses': 'Okulary kocie oko' },
  neck: { None: NONE, Scarf: 'Szalik', 'Bow tie': 'Muszka', Necklace: 'Naszyjnik', Tie: 'Krawat', 'Gold medal': 'Złoty medal', 'Hero cape': 'Peleryna bohatera', 'Flower lei': 'Wieniec z kwiatów',
    'Bell collar': 'Obroża z dzwoneczkiem', Pearls: 'Perły', Bandana: 'Bandana', 'Candy scarf': 'Cukierkowy szalik', 'Coffee bean necklace': 'Naszyjnik z ziaren kawy', 'Feather boa': 'Boa z piór', 'Spiked collar': 'Obroża z ćwiekami', 'Ruff collar': 'Kryza' },
  back: { None: NONE, Backpack: 'Plecak', 'Angel wings': 'Anielskie skrzydła', 'Fairy wings': 'Skrzydła wróżki', Jetpack: 'Plecak odrzutowy', 'Turtle shell': 'Skorupa żółwia', Balloon: 'Balon',
    'Bat wings': 'Skrzydła nietoperza', 'Gift sack': 'Worek z prezentami', Surfboard: 'Deska surfingowa', 'Butterfly wings': 'Skrzydła motyla', 'Takeaway cup': 'Kubek na wynos', 'Pirate flag': 'Piracka bandera', Guitar: 'Gitara' },
  hand: { None: NONE, Flower: 'Kwiatek', Book: 'Książka', Phone: 'Telefon', Bouquet: 'Bukiet', Umbrella: 'Parasol', 'Magic wand': 'Magiczna różdżka', Microphone: 'Mikrofon',
    'Foam sword': 'Piankowy miecz', Handbag: 'Torebka', Trophy: 'Puchar', 'Tennis racket': 'Rakieta tenisowa', 'Mossbun plush': 'Pluszowy Mossbun', Lantern: 'Latarenka',
    'Ice cream cone': 'Lody w rożku', 'Candy cane': 'Laska cukrowa', 'Pumpkin bucket': 'Dyniowe wiaderko', 'Flower basket': 'Koszyk z kwiatami', 'Coffee pot': 'Dzbanek kawy', 'Magnifying glass': 'Lupa', 'Folding fan': 'Wachlarz', Camera: 'Aparat' },
};
const TABS_PL = { Body: 'Ciało', Build: 'Sylwetka', Height: 'Wzrost', Skin: 'Skóra', Face: 'Twarz', 'Face shape': 'Kształt twarzy', Eyes: 'Oczy', 'Eye colour': 'Kolor oczu', Brows: 'Brwi', Nose: 'Nos',
  Mouth: 'Usta', 'Face marks': 'Znaki na twarzy', Hair: 'Włosy', 'Hair style': 'Fryzura', 'Hair colour': 'Kolor włosów', 'Facial hair': 'Zarost', Outfit: 'Strój', Top: 'Góra', 'Top colour': 'Kolor góry',
  Bottom: 'Dół', 'Bottom colour': 'Kolor dołu', Shoes: 'Buty', 'Shoe colour': 'Kolor butów', Extras: 'Dodatki', Hat: 'Nakrycie głowy', Glasses: 'Okulary', Neck: 'Szyja', Back: 'Plecy', 'In hand': 'W dłoni' };
// name: the drop's name. ends: follows "w sprzedaży do …". back: follows "wraca: …".
const SEASONS_PL = {
  winter: { name: 'Zimowa kolekcja', ends: 'końca lutego', back: 'w połowie listopada' },
  spring: { name: 'Wiosenna kolekcja', ends: 'końca maja', back: 'w marcu' },
  summer: { name: 'Letnia kolekcja', ends: 'końca sierpnia', back: 'w czerwcu' },
  halloween: { name: 'Halloweenowa kolekcja', ends: '7 listopada', back: 'w październiku' },
};
export function plAvatar(OPT, AV_TABS, SEASONS) {
  for (const [k, names] of Object.entries(OPT_PL)) if (OPT[k]) OPT[k].forEach((v, i) => { if (names[v]) OPT[k][i] = names[v]; });
  for (const tab of AV_TABS) { tab[0] = TABS_PL[tab[0]] || tab[0]; for (const row of tab[1]) row[1] = TABS_PL[row[1]] || row[1]; }
  for (const [k, x] of Object.entries(SEASONS_PL)) if (SEASONS[k]) Object.assign(SEASONS[k], x);
}

// The Pet Farm's islands, also sold as isle grounds. Pet Farm uses the same names (games/farm).
export const ISLES_PL = { Meadow: 'Łąka', 'Weather Peak': 'Szczyt Pogody', 'Pebble Ridge': 'Kamykowa Grań', 'Fruit Grove': 'Owocowy Gaj', 'Veggie Patch': 'Warzywna Grządka', 'Mossy Woods': 'Omszały Las',
  'Tidepool Cove': 'Zatoczka Pływów', 'Sweet Shop Isle': 'Wyspa Słodyczy', 'Ember Hills': 'Żarzące Wzgórza', 'Bakery Bluff': 'Piekarniany Klif', 'Coral Reef': 'Rafa Koralowa',
  'Starfall Isle': 'Wyspa Spadających Gwiazd', 'Thunder Meadow': 'Burzowa Łąka' };
// label: the kind's name. where: the hint under it. n: item names by their English name.
export const COS_PL = {
  nm: { label: 'Kolor imienia', n: { Plain: 'Zwykły', Sunset: 'Zachód słońca', Ocean: 'Ocean', Mint: 'Mięta', Candy: 'Cukierek', Gold: 'Złoto', Fire: 'Ogień', Rainbow: 'Tęcza', Sparkle: 'Brokat', Frost: 'Szron', Spooky: 'Upiorny', Latte: 'Latte', Blossom: 'Kwitnący', Tropical: 'Tropikalny', Thunder: 'Burza', Pebble: 'Kamyk', 'Lantern glow': 'Blask latarni' } },
  fr: { label: 'Ramka profilu', n: { None: NONE, Cloud: 'Chmurka', Vine: 'Pnącze', Hearts: 'Serduszka', Stars: 'Gwiazdki', Gold: 'Złoto', Flame: 'Płomień', Rainbow: 'Tęcza', Snow: 'Śnieg', 'Coffee ring': 'Kawowa obwódka', Blossom: 'Kwiaty wiśni', Seashells: 'Muszelki', Pumpkins: 'Dynie', Lightning: 'Błyskawice', Pebbles: 'Kamyki', 'Paper lanterns': 'Papierowe lampiony', Leaf: 'Liście', Ember: 'Żar', Tide: 'Fale' } },
  pb: { label: 'Tło wizytówki', n: { None: NONE, 'Paw prints': 'Łapki', Checkers: 'Szachownica', Stars: 'Gwiazdki', Hearts: 'Serduszka', Confetti: 'Konfetti', 'Hot Pot table': 'Stół z kociołkiem',
    'Beanstalk sky': 'Niebo nad fasolą', 'Pet Farm meadow': 'Łąka z Farmy zwierzaków', 'Kart island': 'Gokartowa wyspa', 'Card table': 'Stół karciany', 'Drifting clouds': 'Płynące chmury',
    'Falling petals': 'Spadające płatki', 'Twinkling night': 'Migocząca noc', Podium: 'Podium', 'Golden champion': 'Złoty mistrz', 'Egg nest': 'Gniazdo z jajkami', 'Pet parade': 'Parada zwierzaków', 'Café': 'Kawiarnia', 'Leaf sprouts': 'Listki', 'Ember flames': 'Płomyki', 'Tide waves': 'Fale', 'Spark bolts': 'Błyskawice', 'Stone pebbles': 'Kamyki', 'Bubble lagoon': 'Bąbelkowa laguna', Dartboard: 'Tarcza do rzutek',
    'Dice table': 'Stół do kości', 'Mini golf green': 'Pole do minigolfa', Beach: 'Plaża', 'Pumpkin patch': 'Dyniowe pole', 'Snowy night': 'Śnieżna noc', Thunderstorm: 'Burza', 'Chess board': 'Szachownica', 'Pool table': 'Stół bilardowy', 'Domino line': 'Linia domina',
    'Lantern Night': 'Noc latarni', 'Copycat barn': 'Stodoła przebierańców', 'Runway lights': 'Światła wybiegu', 'Word Reef board': 'Plansza Słownej rafy', 'Checkers board': 'Plansza do warcabów', 'Pet Museum': 'Muzeum zwierzaków', 'Legend ruins': 'Ruiny Wyspy Legend' } },
  // Titles describe the player, so they are worded to fit anyone.
  ti: { label: 'Tytuł', n: { None: NONE, 'Pot Wizard': 'Garnkowa magia', 'Card Shark': 'Karciany rekin', 'Kart Menace': 'Postrach toru', 'Marble Whisperer': 'Kulkowa wyrocznia', 'Ladder Legend': 'Legenda drabin',
    'Ludo Lord': 'Szycha od Chińczyka', 'Tower Titan': 'Tytan wież', 'Hole in One': 'Dołek za jednym', 'Smooth Liar': 'Gładki blef', 'Top Dog': 'Gruba ryba', 'Head Chef': 'Głowa kuchni',
    'Treasure Hunter': 'Nos do skarbów', Regular: 'Częsty gość', Champion: 'Klasa mistrzowska', 'Snack Lord': 'Postrach lodówki', 'Lucky Duck': 'Farciarska kaczka', 'Just Vibing': 'Luz i spokój',
    'Sore Loser': 'Foch po przegranej', 'Bot Bully': 'Postrach botów', 'Certified Goblin': 'Goblin z certyfikatem', 'Big Spender': 'Gruby portfel', 'Trick Taker': 'Lewa za lewą',
    'Brick Boss': 'Klockowa szycha', 'Bean Bouncer': 'Fasolowa sprężyna', 'Pet Detective': 'Detektyw od zwierzaków', 'Party Roller': 'Imprezowe kości', Bullseye: 'W dziesiątkę', 'Three in a Row': 'Trzy w rzędzie', 'Double Six': 'Podwójna szóstka', 'Coconut Captain': 'Kokosowy kapitan', 'Parade Leader': 'Na czele parady', 'Eagle Eye': 'Sokole oko', 'Coffee’s on me': 'Kawa na mój koszt', 'Bubble Buster': 'Postrach bąbelków', 'Nine of Hearts': 'Dziewiątka kier', 'Pair Master': 'Para za parą', 'Pet Collector': 'Kolekcja zwierzaków', 'Walking Atlas': 'Chodzący atlas', 'Makao Master': 'Mistrz makao', 'Card General': 'Karciany generał', Checkmate: 'Szach-mat', 'Quick Sketch': 'Szybka kreska', 'Pool Shark': 'Rekin bilardu', 'Twenty-One': 'Dwadzieścia jeden', 'Bop Champ': 'Mistrz pacania', 'Tile Racer': 'Mahjongowy sprinter', 'Steady Hand': 'Pewna ręka', 'King Me': 'Damka!', Wordsmith: 'Mistrz słowa',
    Lamplighter: 'Latarnia nocy', 'Master of Disguise': 'Mistrz przebrań', 'Runway Star': 'Gwiazda wybiegu', 'Memory Ace': 'As pamięci', 'Journal Keeper': 'Żywa kronika farmy', 'Legend Seeker': 'Śladami legend', 'Museum Curator': 'Muzealna perła', 'Order Runner': 'Ekspres z wysp' } },
  wn: { label: 'Efekt wygranej', n: { None: NONE, Confetti: 'Konfetti', Hearts: 'Serduszka', 'Fish rain': 'Deszcz ryb', Fireworks: 'Fajerwerki', 'Coin shower': 'Deszcz monet', Snowfall: 'Śnieg', 'Coffee break': 'Przerwa na kawę', Blossoms: 'Kwiaty', Bubbles: 'Bąbelki', Bats: 'Nietoperze', 'Paw prints': 'Łapki', 'Sky lanterns': 'Lampiony na niebie', 'Camera flashes': 'Flesze aparatów', 'Letter rain': 'Deszcz liter' } },
  em: { label: 'Emotki', where: 'To, co twój awatar potrafi na Placu. Dotknij tych, które masz, żeby ustawić do sześciu na pasku emotek.', n: { None: 'Brak', Wave: 'Pomachaj', Dance: 'Tańcz', Sit: 'Usiądź', Jump: 'Skocz', Cheer: 'Wiwat', 'Pet trick': 'Sztuczka', Clap: 'Brawa', Bow: 'Ukłon', Twirl: 'Piruet', Laugh: 'Śmiech', Nap: 'Drzemka', 'Blow a kiss': 'Buziak', 'Snow angel': 'Aniołek na śniegu', Shiver: 'Brr!', Backflip: 'Salto', Robot: 'Robot', 'Star shower': 'Deszcz gwiazd', 'Strike a pose': 'Poza!', 'Catwalk strut': 'Krok modelki' } },
  sp: { label: 'Paczki naklejek', n: { Basics: 'Podstawowe', Party: 'Impreza', Critters: 'Zwierzątka', Chaos: 'Chaos', 'Café': 'Kawiarnia', Grumpy: 'Fochy', Drama: 'Dramat', Love: 'Czułości', Hype: 'Na fali', Sleepy: 'Śpioch', Hmm: 'Hmm…', Winter: 'Zima', Sus: 'Podejrzane', Fashion: 'Moda' } },
  cb: { label: 'Rewers kart', where: 'Twoje karty w grach Texas Hold’em, Tysiąc, Pan i Piotruś oraz talia, którą widzisz w grze Gorący kociołek.', n: { Classic: 'Klasyczny', Sky: 'Niebo', Midnight: 'Północ', Candy: 'Cukierek', Koi: 'Koi', 'Gold leaf': 'Złoty listek', 'Coffee beans': 'Ziarna kawy', Leaf: 'Liść', Ember: 'Żar', Tide: 'Fala', Spark: 'Iskra', Stone: 'Kamień', 'Paw prints': 'Łapki', Blossom: 'Kwiaty wiśni', Snowflakes: 'Śnieżynki', Rainbow: 'Tęcza' } },
  dc: { label: 'Kości', where: 'Twoje kości w grach Kości kłamcy, Kości, Chińczyk, Węże i drabiny oraz Łapolis.', n: { Classic: 'Klasyczne', 'Ruby gem': 'Rubin', 'Carved jade': 'Rzeźbiony jadeit',
    Bubblegum: 'Guma balonowa', 'Starry midnight': 'Gwiaździsta północ', 'Solid gold': 'Lite złoto', 'Oak wood': 'Dąb', 'Ice crystal': 'Kryształ lodu', 'Paw prints': 'Łapki', 'Lava rock': 'Skała lawowa',
    Snowball: 'Śnieżka', 'Choc-chip cookie': 'Ciastko z czekoladą', 'Mossy stone': 'Omszały kamień', Pixel: 'Piksele', 'Sugar cube': 'Kostka cukru' } },
  gb: { label: 'Piłka golfowa', where: 'Twoja piłka w grze Imprezowy minigolf.', n: { Classic: 'Klasyczna', '8-ball': 'Ósemka', Watermelon: 'Arbuz', Planet: 'Planeta', Eyeball: 'Gałka oczna', Gold: 'Złota', 'Latte art': 'Latte art', Bubble: 'Bąbelek', Fireball: 'Kula ognia', 'Beach ball': 'Piłka plażowa', 'Tennis ball': 'Piłka tenisowa', Football: 'Piłka nożna', Moon: 'Księżyc', 'Disco ball': 'Kula dyskotekowa', Pumpkin: 'Dynia', 'Paw print': 'Łapka' } },
  kp: { label: 'Lakier gokarta', where: 'Twój gokart w grze Wyspiarskie gokarty.', n: { Classic: 'Klasyczny', 'Racing stripes': 'Pasy wyścigowe', Checkers: 'Szachownica', Flames: 'Płomienie', Galaxy: 'Galaktyka', Gold: 'Złoty', 'Mocha': 'Mokka', Lightning: 'Błyskawice', 'Ocean waves': 'Morskie fale', 'Candy stripes': 'Cukierkowe paski', Taxi: 'Taksówka', Ladybird: 'Biedronka', Tiger: 'Tygrys', Rainbow: 'Tęcza', Watermelon: 'Arbuz', Ice: 'Lód' } },
  cu: { label: 'Kij bilardowy', where: 'Twój kij w grze Podniebny bilard.', n: { Classic: 'Klasyczny', Ebony: 'Heban', 'Candy cane': 'Cukrowa laska', Bamboo: 'Bambus', Pencil: 'Ołówek', Rainbow: 'Tęcza', Gold: 'Złoty',
    'Magic wand': 'Magiczna różdżka', Carrot: 'Marchewka', Icicle: 'Sopel', Lightning: 'Błyskawice' } },
  cs: { label: 'Szachy', where: 'Twoje figury w grze Szachy. Twoja strona zostaje jasna albo ciemna, więc obie armie zawsze da się odróżnić.', n: { Classic: 'Klasyczne', Marble: 'Marmur', Candy: 'Cukierki', Ocean: 'Ocean', Forest: 'Las', Royal: 'Królewskie',
    Lava: 'Lawa', Spooky: 'Straszne', Frost: 'Mróz', Neon: 'Neon' } },
  ck: { label: 'Warcaby', where: 'Twoje pionki w grze Warcaby. Twoja strona zostaje jasna albo ciemna, więc obie armie zawsze da się odróżnić.', n: { Classic: 'Klasyczne', Wood: 'Drewno', Cookies: 'Ciasteczka', Buttons: 'Guziki',
    Coins: 'Monety', Paws: 'Łapki', Flowers: 'Kwiatki', Stars: 'Gwiazdki', Frost: 'Mróz', Pumpkins: 'Dynie', Gems: 'Klejnoty' } },
  dm: { label: 'Kostki domina', where: 'Twoje kostki w grze Domino: te na ręku i każda, którą dołożysz na stół.', n: { Classic: 'Klasyczne', Ebony: 'Heban', Wood: 'Drewno', Jade: 'Jadeit', Bubblegum: 'Guma balonowa', Midnight: 'Północ', Gold: 'Złote',
    Ice: 'Lód', Pumpkin: 'Dynia', Neon: 'Neon' } },
  rt: { label: 'Płytki Słownej rafy', where: 'Twoje płytki z literami w grze Słowna rafa: te na stojaku i każde słowo, które ułożysz na planszy.', n: { Classic: 'Klasyczne', Driftwood: 'Drewno z morza', Coral: 'Koral', Pearl: 'Perła', 'Sea glass': 'Morskie szkiełko', Ink: 'Atrament', Starfish: 'Rozgwiazda', Ice: 'Lód', Pumpkin: 'Dynia' } },
  ln: { label: 'Lampion', where: 'Lampion, który unosi się obok ciebie w grze Noc latarni, i kolor jego światła na twoim ekranie. Każdy lampion świeci tak samo daleko.', n: { Classic: 'Klasyczny', 'Paper lantern': 'Papierowy lampion', 'Firefly jar': 'Słoik ze świetlikami', Candle: 'Świeca', Crystal: 'Kryształ', Star: 'Gwiazda', Pumpkin: 'Dynia' } },
  ig: { label: 'Podłoże', where: 'Nadaj swojej wyspie wygląd jednej z wysp Farmy zwierzaków. Wszyscy widzą ją na twojej wizytówce, a twoja wyspa na Farmie zwierzaków też ją nosi.', n: { ...ISLES_PL, 'Golden isle': 'Złota wyspa', 'Champion’s isle': 'Wyspa mistrzów', 'Legend Isle': 'Wyspa Legend' } },
  ib: { label: 'Skalna podstawa', where: 'To, co wisi pod twoją wyspą i pod wyspą na Farmie zwierzaków.', n: { Classic: 'Klasyczna', 'Crystal cluster': 'Kryształy', 'Floating chunks': 'Latające odłamki', Waterfall: 'Wodospad', 'Hanging roots': 'Wiszące korzenie' } },
  ik: { label: 'Niebo', where: 'Niebo za twoją wyspą i za wyspą na Farmie zwierzaków.', n: { Clear: 'Czyste', Sunset: 'Zachód słońca', 'Starry night': 'Gwiaździsta noc', Aurora: 'Zorza', Rainbow: 'Tęcza', 'Lantern night': 'Noc lampionów' } },
};
const PIECES_PL = { marble: 'Kulka', die: 'Kość', pawn: 'Pionek', card: 'Karta', chip: 'Żeton', golf: 'Piłka golfowa', block: 'Klocki', tyre: 'Opona gokarta', coin: 'Moneta', star: 'Gwiazdka', bean: 'Magiczna fasolka', pot: 'Garnek', paw: 'Łapka', dart: 'Rzutka', bubble: 'Bąbelek', egg: 'Jajko zwierzaka', knight: 'Skoczek', eight: 'Ósemka', domino: 'Kostka domina', bingo: 'Kula bingo', lantern: 'Latarnia', checker: 'Damka', letter: 'Płytka z literą', crate: 'Skrzynka przebierańca', hanger: 'Wieszak', stamp: 'Pieczątka', charm: 'Amulet gniazda' };
export function plCosmetics(COS, PIECES) {
  for (const [k, x] of Object.entries(COS_PL)) {
    const kind = COS[k]; if (!kind) continue;
    kind.label = x.label; if (x.where) kind.where = x.where;
    for (const it of kind.items) if (x.n[it.n]) it.n = x.n[it.n];
  }
  for (const [k, n] of Object.entries(PIECES_PL)) if (PIECES[k]) PIECES[k] = n;
}
