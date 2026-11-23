// Lucky Wheel words shared by the wheel window and Pet Farm: what each booster does, in both languages.
import { L } from './i18n.js';
import { BOOSTS } from './wheelprizes.js';

export const boostName = type => ({
  garden: L('Garden booster', 'Wzmocnienie grządek'), gate: L('Expedition booster', 'Wzmocnienie wypraw'), yard: L('Training booster', 'Wzmocnienie treningu'),
  nest: L('Nest booster', 'Wzmocnienie Gniazda'), kitchen: L('Kitchen booster', 'Wzmocnienie Kuchni'),
})[type] || type;
export const boostWhat = type => ({
  garden: L(`Garden Plots ripen twice as fast for ${BOOSTS.garden.hours} hours.`, `Grządki dojrzewają dwa razy szybciej przez ${BOOSTS.garden.hours} godziny.`),
  gate: L(`Your next ${BOOSTS.gate.uses} parties come home in half the time.`, `Twoje następne ${BOOSTS.gate.uses} drużyny wracają w połowie czasu.`),
  yard: L(`The Training Yard gives double experience for ${BOOSTS.yard.hours} hours.`, `Plac treningowy daje podwójne doświadczenie przez ${BOOSTS.yard.hours} godzin.`),
  nest: L('Your next egg hatches in half the time.', 'Twoje następne jajko wykluje się w połowie czasu.'),
  kitchen: L(`Your next ${BOOSTS.kitchen.uses} treats come out double.`, `Twoje następne ${BOOSTS.kitchen.uses} smakołyków wychodzi podwójnie.`),
})[type] || '';
