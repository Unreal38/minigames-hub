// Kalambury word lists: Polish and English, by theme. Every word is something you can draw, and safe for a family table.
// The lists stay on the server, so nobody can look the answer up in the page's files.
// A word may list other accepted spellings after a bar: 'samochód|auto'.
import { SPECIES } from '../../public/games/farm/data.js';

const list = s => s.split(',').map(w => w.trim()).filter(Boolean);

const PL = {
  animals: list(`kot, pies, koń, krowa, świnia, owca, koza, kura, kogut, kaczka, gęś, indyk, królik, chomik, mysz, szczur, jeż, wiewiórka, lis, wilk,
    niedźwiedź, jeleń, dzik, zając, bóbr, kret, nietoperz, sowa, orzeł, bocian, dzięcioł, papuga, pingwin, flaming, paw, struś, łabędź, wróbel, gołąb, słoń,
    żyrafa, lew, tygrys, zebra, małpa, goryl, hipopotam, nosorożec, krokodyl, wąż, żółw, jaszczurka, kameleon, żaba, ryba, rekin, delfin, wieloryb, ośmiornica, meduza,
    krab, rak, ślimak, pająk, mrówka, pszczoła, osa, motyl, biedronka, komar, mucha, ważka, konik polny, gąsienica, dżdżownica, kangur, koala, panda, wielbłąd, lama,
    foka, mors, renifer, łoś, leniwiec, skunks, szop, borsuk, wydra, konik morski, rozgwiazda, dinozaur, mamut, osioł, bawół, lampart, gepard, hiena, surykatka, pelikan,
    tukan, koliber, mewa, kruk, sroka, kukułka, jaskółka, karp, złota rybka, płaszczka, homar, krewetka, stonoga, skorpion, żuk, ćma, świnka morska, jamnik, pudel, kociak, szczeniak`),
  food: list(`jabłko, gruszka, banan, pomarańcza, cytryna, truskawka, malina, wiśnia, arbuz, winogrona, ananas, śliwka, kokos, brzoskwinia, kiwi, marchewka, ziemniak, pomidor, ogórek, cebula,
    czosnek, papryka, kukurydza, dynia, grzyb, sałata, kapusta, brokuł, groszek, burak, rzodkiewka, chleb, bułka, rogalik, pączek, ser, masło, jajko, jajecznica, mleko,
    jogurt, lody, tort, ciasto, ciastko, czekolada, cukierek, lizak, miód, dżem, naleśnik, gofr, pierogi, zupa, rosół, kotlet, kiełbasa, szynka, kanapka, hamburger,
    hot dog, pizza, frytki, spaghetti, makaron, ryż, sushi, popcorn, herbata, kawa, sok, lemoniada, piernik, zapiekanka, kebab, precel, obwarzanek, szarlotka, sernik, galaretka,
    budyń, orzech, żelki, guma do żucia, chipsy, tost, omlet, keczup, musztarda, sól, pieprz, płatki śniadaniowe, kisiel, bita śmietana, wata cukrowa, lody na patyku, babeczka, drożdżówka, parówka, barszcz,
    żurek, placki ziemniaczane, kopytka, kluski, sałatka, koktajl, kakao, oscypek, kabanos, ogórek kiszony`),
  things: list(`krzesło, stół, łóżko, szafa, lampa, lustro, zegar, budzik, telefon, telewizor, komputer, klawiatura, słuchawki, aparat fotograficzny|aparat, radio, lodówka, pralka, odkurzacz, żelazko, czajnik,
    garnek, patelnia, talerz, kubek, szklanka, widelec, nóż, łyżka, butelka, klucz, kłódka, drzwi, okno, schody, drabina, młotek, śrubokręt, piła, gwóźdź, nożyczki,
    igła, guzik, parasol, plecak, torebka, walizka, portfel, okulary, kapelusz, czapka, szalik, rękawiczki, buty, kalosze, skarpetki, spodnie, sukienka, koszula, kurtka, krawat,
    pasek, pierścionek, korona, zegarek, książka, zeszyt, ołówek, długopis, kredka, pędzel, gumka, linijka, piórnik, gazeta, koperta, znaczek, świeca, żarówka, latarka, bateria,
    magnes, lupa, kompas, mapa, globus, piłka, balon, latawiec, lalka, pluszowy miś|miś, klocki, puzzle, gitara, bęben, skrzypce, pianino, trąbka, flet, mikrofon, szczoteczka do zębów,
    mydło, ręcznik, grzebień, wanna, prysznic, poduszka, koc, dywan, wazon, doniczka, konewka, grabie, łopata, taczka, wiadro, miotła, kosz na śmieci, skarbonka, prezent, medal,
    puchar, termometr, waga, kalkulator, pilot, kamera, luneta, teleskop, mikroskop, gwizdek, dzwonek, kotwica, lina, łańcuch, wieszak, suszarka, wentylator, kaloryfer, kominek, fotel,
    kanapa, hamak, śpiwór, termos, lornetka, klepsydra, kalendarz, zamek błyskawiczny, agrafka, spinacz`),
  nature: list(`słońce, księżyc, gwiazda, chmura, deszcz, śnieg, burza, piorun, tęcza, wiatr, mgła, tornado, góra, wulkan, jaskinia, las, drzewo, choinka, palma, kaktus,
    kwiat, róża, tulipan, słonecznik, stokrotka, liść, trawa, krzak, rzeka, jezioro, morze, plaża, wyspa, wodospad, pustynia, dżungla, łąka, pole, ogród, sad,
    most, droga, tunel, dom, blok, zamek, wieża, kościół, szkoła, szpital, sklep, kino, teatr, muzeum, zoo, cyrk, lotnisko, dworzec, port, latarnia morska,
    wiatrak, młyn, stodoła, płot, studnia, fontanna, pomnik, piramida, igloo, ognisko, bałwan, sopel, kałuża, fala, muszla, kamień, planeta, kometa, lodowiec, bagno,
    gniazdo, ul, mrowisko, pajęczyna, żołądź, szyszka, kasztan, koniczyna, mak, lawenda, bambus, pień, korzeń, gałąź, staw, strumień, klif, kanion, oaza, rafa koralowa,
    zachód słońca, zorza polarna, zaćmienie, plac zabaw, boisko, basen, biblioteka, piekarnia, apteka, stacja benzynowa, parking, skrzyżowanie, rondo, przystanek, farma, szklarnia, altana, domek na drzewie, wieżowiec, chatka`),
  people: list(`lekarz, pielęgniarka, strażak, policjant, nauczyciel, kucharz, piekarz, fryzjer, dentysta, malarz, muzyk, piosenkarz, aktor, klaun, magik, pilot samolotu, kierowca, kapitan, marynarz, rybak,
    rolnik, ogrodnik, listonosz, mechanik, budowlaniec, górnik, astronauta, naukowiec, detektyw, sędzia, żołnierz, rycerz, król, królowa, księżniczka, pirat, czarodziej, czarownica, wróżka, syrena,
    duch, wampir, robot, kosmita, olbrzym, krasnoludek, elf, ninja, kowboj, superbohater, mumia, szkielet, święty mikołaj|mikołaj, niemowlę, babcia, dziadek, bliźniaki, panna młoda, piłkarz, bokser,
    pływak, narciarz, baletnica, nurek, alpinista, kelner, fotograf, dyrygent, weterynarz, złodziej, strach na wróble, smok, jednorożec, wilkołak, zombie, anioł, diabełek, troll, cyklop, centaur,
    pegaz, feniks, yeti, trzy świnki, czerwony kapturek, kot w butach, królewna śnieżka, pinokio, kopciuszek, śpiąca królewna, calineczka, dżin, wiking, gladiator, faraon, samuraj, szpieg, sprzątaczka, ratownik, kominiarz,
    szewc, krawiec, kowal, pszczelarz, pasterz, rzeźbiarz, żongler, akrobata, treser, kaskader`),
  fun: list(`samochód|auto, autobus, tramwaj, pociąg, metro, samolot, helikopter|śmigłowiec, sterowiec, statek, łódka|łódź, żaglówka, kajak, łódź podwodna, motocykl|motor, traktor, koparka, dźwig, ciężarówka, karetka, wóz strażacki,
    radiowóz, taksówka, wózek dziecięcy|wózek, spadochron, rolki, rower, hulajnoga, deskorolka, sanki, narty, łyżwy, huśtawka, zjeżdżalnia, namiot, wędka, rakieta, ufo, balon na gorące powietrze, piłka nożna, koszykówka,
    siatkówka, tenis, hokej, golf, kręgle, szachy, warcaby, karty, kostka do gry|kostka, domino, bilard, rzutki, łuk, karuzela, diabelski młyn, kolejka górska|rollercoaster, trampolina, fajerwerki, urodziny, piknik,
    grill, biwak, taniec, koncert, bitwa na śnieżki, drzemka, selfie, skakanka, hula hop, jojo, bańki mydlane, zamek z piasku, puszczanie latawca, gra w klasy, chowanego|zabawa w chowanego, przeciąganie liny, wyścig, maraton, podium, bramka,
    rakieta tenisowa, kij hokejowy, deska surfingowa|surfing, snowboard, kask, gokart, quad, skuter, riksza, sanie, dorożka, wóz, gondola, tratwa, prom, lotnia, kolejka linowa, winda, ruchome schody, bumerang,
    proca, piniata, konfetti, labirynt, kręgielnia, tor przeszkód, teatrzyk kukiełkowy, cymbałki, bujany koń, układanka`),
};

const EN = {
  animals: list(`cat, dog, horse, cow, pig, sheep, goat, hen, rooster, duck, goose, turkey, rabbit, hamster, mouse, rat, hedgehog, squirrel, fox, wolf,
    bear, deer, wild boar|boar, hare, beaver, mole, bat, owl, eagle, stork, woodpecker, parrot, penguin, flamingo, peacock, ostrich, swan, sparrow, pigeon, elephant,
    giraffe, lion, tiger, zebra, monkey, gorilla, hippo|hippopotamus, rhino|rhinoceros, crocodile, snake, turtle, lizard, chameleon, frog, fish, shark, dolphin, whale, octopus, jellyfish,
    crab, crayfish, snail, spider, ant, bee, wasp, butterfly, ladybird|ladybug, mosquito, fly, dragonfly, grasshopper, caterpillar, earthworm|worm, kangaroo, koala, panda, camel, llama,
    seal, walrus, reindeer, moose, sloth, skunk, raccoon, badger, otter, seahorse, starfish, dinosaur, mammoth, donkey, buffalo, leopard, cheetah, hyena, meerkat, pelican,
    toucan, hummingbird, seagull, raven, magpie, cuckoo, swallow, goldfish, stingray, lobster, shrimp, centipede, scorpion, beetle, moth, guinea pig, sausage dog|dachshund, poodle, kitten, puppy`),
  food: list(`apple, pear, banana, orange, lemon, strawberry, raspberry, cherry, watermelon, grapes, pineapple, plum, coconut, peach, kiwi, carrot, potato, tomato, cucumber, onion,
    garlic, pepper, corn, pumpkin, mushroom, lettuce, cabbage, broccoli, peas, beetroot, radish, bread, bread roll|roll, croissant, doughnut|donut, cheese, butter, egg, scrambled eggs, milk,
    yoghurt|yogurt, ice cream, birthday cake|cake, pie, cookie|biscuit, chocolate, sweet|candy, lollipop, honey, jam, pancake, waffle, dumplings, soup, noodles, meatball, sausage, ham, sandwich, hamburger|burger,
    hot dog, pizza, chips|fries, spaghetti, pasta, rice, sushi, popcorn, tea, coffee, juice, lemonade, gingerbread, toast, kebab, pretzel, bagel, apple pie, cheesecake, jelly,
    pudding, nut, gummy bears, chewing gum|bubble gum, crisps, omelette|omelet, ketchup, mustard, salt, cereal, whipped cream, candy floss|cotton candy, ice lolly|popsicle, cupcake, muffin, salad, milkshake, hot chocolate|cocoa, pickle, taco,
    burrito, fried egg, bacon, porridge, baguette, marshmallow, smoothie, fish fingers|fish sticks, stew, avocado`),
  things: list(`chair, table, bed, wardrobe, lamp, mirror, clock, alarm clock, phone, television|tv, computer, keyboard, headphones, camera, radio, fridge, washing machine, vacuum cleaner|hoover, iron, kettle,
    pot, frying pan|pan, plate, mug, glass, fork, knife, spoon, bottle, key, padlock, door, window, stairs, ladder, hammer, screwdriver, saw, nail, scissors,
    needle, button, umbrella, backpack|rucksack, handbag, suitcase, wallet, glasses, hat, cap, scarf, gloves, shoes, wellies|rain boots, socks, trousers|pants, dress, shirt, jacket, tie,
    belt, ring, crown, watch, book, notebook, pencil, pen, crayon, paintbrush, rubber|eraser, ruler, pencil case, newspaper, envelope, stamp, candle, light bulb, torch|flashlight, battery,
    magnet, magnifying glass, compass, map, globe, ball, balloon, kite, doll, teddy bear, building blocks|blocks, jigsaw|puzzle, guitar, drum, violin, piano, trumpet, flute, microphone, toothbrush,
    soap, towel, comb, bathtub|bath, shower, pillow, blanket, rug|carpet, vase, flowerpot, watering can, rake, shovel|spade, wheelbarrow, bucket, broom, bin|trash can, piggy bank, present|gift, medal,
    trophy, thermometer, scales, calculator, remote control|remote, telescope, microscope, whistle, bell, anchor, rope, chain, hanger, hairdryer, fan, fireplace, armchair, sofa|couch, hammock, sleeping bag,
    flask|thermos, binoculars, hourglass, calendar, zip|zipper, safety pin, paperclip, treasure chest, tent, lantern`),
  nature: list(`sun, moon, star, cloud, rain, snow, storm, lightning, rainbow, wind, fog, tornado, mountain, volcano, cave, forest, tree, christmas tree, palm tree, cactus,
    flower, rose, tulip, sunflower, daisy, leaf, grass, bush, river, lake, sea, beach, island, waterfall, desert, jungle, meadow, field, garden, orchard,
    bridge, road, tunnel, house, block of flats|apartment building, castle, tower, church, school, hospital, shop|store, cinema, theatre|theater, museum, zoo, circus, airport, railway station|train station, harbour|harbor, lighthouse,
    windmill, barn, fence, well, fountain, statue, pyramid, igloo, campfire, snowman, icicle, puddle, wave, seashell|shell, rock, planet, comet, glacier, swamp, nest,
    beehive, anthill, spiderweb|cobweb, acorn, pine cone, conker|chestnut, clover, poppy, lavender, bamboo, tree stump|stump, root, branch, pond, stream, cliff, canyon, oasis, coral reef, sunset,
    northern lights|aurora, eclipse, playground, football pitch|soccer field, swimming pool|pool, library, bakery, pharmacy, petrol station|gas station, car park|parking lot, crossroads, roundabout, bus stop, farm, greenhouse, treehouse, skyscraper, cottage, hut, iceberg`),
  people: list(`doctor, nurse, firefighter, police officer, teacher, cook|chef, baker, hairdresser, dentist, painter, musician, singer, actor, clown, magician, pilot, driver, captain, sailor, fisherman,
    farmer, gardener, postman|mail carrier, mechanic, builder, miner, astronaut, scientist, detective, judge, soldier, knight, king, queen, princess, pirate, wizard, witch, fairy, mermaid,
    ghost, vampire, robot, alien, giant, gnome, elf, ninja, cowboy, superhero, mummy, skeleton, santa claus|santa, baby, grandma|grandmother, grandpa|grandfather, twins, bride, footballer|soccer player, boxer,
    swimmer, skier, ballerina, diver, mountain climber|climber, waiter, photographer, conductor, vet, thief|burglar, scarecrow, dragon, unicorn, werewolf, zombie, angel, troll, cyclops, centaur, pegasus,
    phoenix, yeti, three little pigs, little red riding hood, puss in boots, snow white, pinocchio, cinderella, sleeping beauty, genie, viking, gladiator, pharaoh, samurai, spy, lifeguard, chimney sweep, shoemaker, tailor, blacksmith,
    beekeeper, shepherd, sculptor, juggler, acrobat, lion tamer, stuntman, tooth fairy, gingerbread man, snow queen`),
  fun: list(`car, bus, tram, train, underground|subway, plane|airplane, helicopter, airship|blimp, ship, boat, sailing boat|sailboat, kayak, submarine, motorbike|motorcycle, tractor, digger|excavator, crane, lorry|truck, ambulance, fire engine|fire truck,
    police car, taxi, pram|stroller, parachute, roller skates, bike|bicycle, scooter, skateboard, sledge|sled, skis, ice skates, swing, slide, fishing rod, rocket, ufo, hot air balloon, football|soccer, basketball, volleyball,
    tennis, hockey, golf, bowling, chess, draughts|checkers, playing cards|cards, dice, dominoes, pool table|billiards, darts, bow and arrow, merry-go-round|carousel, ferris wheel|big wheel, roller coaster|rollercoaster, trampoline, fireworks, birthday party|birthday, picnic,
    barbecue|bbq, camping, dance, concert, snowball fight, nap, selfie, skipping rope|jump rope, hula hoop, yo-yo, soap bubbles|bubbles, sandcastle, hopscotch, hide and seek, tug of war, race, marathon, podium, goal,
    tennis racket, hockey stick, surfboard, snowboard, helmet, go-kart, quad bike, moped, rickshaw, sleigh, horse and cart|carriage, wagon, gondola, raft, ferry, hang glider, cable car, lift|elevator, escalator, boomerang,
    slingshot|catapult, piñata, confetti, maze, puppet show, xylophone, rocking horse, treasure hunt, pillow fight, seesaw`),
};

// Pet Farm pets are the same in every language, and the drawer gets the pet's picture to draw from.
const PETS = Object.entries(SPECIES).map(([sp, d]) => ({ w: d.name, sp }));

const parse = (entry, theme) => { const [w, ...alts] = entry.split('|').map(x => x.trim()); return { w, alts, theme }; };
const BOOK = Object.fromEntries(Object.entries({ pl: PL, en: EN }).map(([lang, by]) => [lang, Object.fromEntries(Object.entries(by).map(([t, ws]) => [t, ws.map(w => parse(w, t))]))]));
export const LANGS = ['pl', 'en'];
export const WORD_THEMES = Object.keys(PL);

// Every word a table can get: one theme, or all of them (the pets only when the table asks for them).
export function poolOf(lang, theme) {
  if (theme === 'pets') return PETS.map(p => ({ ...p, alts: [], theme: 'pets' }));
  const by = BOOK[lang] || BOOK.pl;
  return by[theme] ? by[theme] : Object.values(by).flat();
}
