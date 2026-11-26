/**
 * Pojemniki na wodę (podręcznik s. 218, 223, 224, 229) — czyste funkcje, bez Foundry.
 *   Canteen — 4 porcje (dzień picia), Canteen (Stable-Tec) — 12 (3 dni), Milk Bottle — 2, Flask i Empty Soda Bottle — 1.
 * Zawartość w flagach przedmiotu: flags.foe-rpg.water = { n, name, desc, taint } (desc — opis napoju do foodInfo).
 * Porcja waży 1 lb (jak Purified/Dirty Water w katalogu). Mieszanie: liczy się gorsza woda (więcej radów, skażenie).
 */
const F = "foe-rpg";

const CONTAINERS = [
  [/^canteen\s*\(stable-?tec\)/i, 12],
  [/^canteen\b/i, 4],
  [/^milk bottle\b/i, 2],
  [/^flask\b/i, 1],
  [/^empty soda bottle\b/i, 1]
];

/** Ile porcji mieści przedmiot (0 — to nie pojemnik). Flaga `capacity` nadpisuje (np. własne pojemniki MG). */
export function waterCapacity(item) {
  const own = Number(item?.flags?.[F]?.capacity);
  if (own > 0) return Math.floor(own);
  if (item?.type && item.type !== "gear") return 0;
  const name = String(item?.name ?? "");
  for (const [re, n] of CONTAINERS) if (re.test(name)) return n;
  return 0;
}

/** Pojemność całego stosu (2 manierki w jednym wierszu ekwipunku — 2 × 4 porcje). */
export const stackCapacity = item => waterCapacity(item) * Math.max(1, Math.floor(Number(item?.system?.qty) || 1));

/** Zawartość pojemnika (n — porcje) albo null, gdy pusty. */
export function waterOf(item) {
  const w = item?.flags?.[F]?.water;
  const n = Math.max(0, Math.floor(Number(w?.n) || 0));
  return n ? { n, name: String(w.name ?? ""), desc: String(w.desc ?? ""), taint: Math.max(0, Number(w.taint) || 0) } : null;
}

/** Ciężar wody w pojemniku (lb, dla całego stosu — porcja waży 1 lb). */
export const waterWeight = item => (waterCapacity(item) ? waterOf(item)?.n ?? 0 : 0);

/**
 * Dolanie `add` porcji napoju { name, desc, rads, taint } do zawartości `cur` (pojemność cap).
 * Zwraca { water, poured } — water: nowa zawartość, poured: ile weszło. Mieszanka przyjmuje gorszy napój.
 */
export function pour(cur, drink, add, cap, radsOf = () => 0) {
  const have = cur?.n ?? 0;
  const poured = Math.max(0, Math.min(Math.floor(Number(add) || 0), cap - have));
  if (!poured) return { water: cur ?? null, poured: 0 };
  if (!have) return { water: { n: poured, name: drink.name, desc: drink.desc, taint: Math.max(0, Number(drink.taint) || 0) }, poured };
  const worse = radsOf(drink.desc) > radsOf(cur.desc) || (Number(drink.taint) || 0) > (cur.taint || 0) ? drink : cur;
  return {
    water: { n: have + poured, name: worse.name, desc: worse.desc, taint: Math.max(cur.taint || 0, Number(drink.taint) || 0) },
    poured
  };
}

/** Wypicie `k` porcji: nowa zawartość (null — pusty). */
export function sip(cur, k = 1) {
  const n = (cur?.n ?? 0) - Math.max(0, Math.floor(Number(k) || 0));
  return n > 0 ? { ...cur, n } : null;
}
