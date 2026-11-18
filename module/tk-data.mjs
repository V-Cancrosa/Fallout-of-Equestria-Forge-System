/**
 * Telekineza (s. 252–253 i karty zaklęć) — czyste funkcje, bez Foundry:
 *   - udźwig: 2×INT (Mighty Telekinesis I 6×, II 18×, III i IV 250×INT),
 *   - zasięg: 5×INT ft (Long Ranged Telekinesis 50×INT ft),
 *   - rzut: rzecz lżejsza niż ¼ udźwigu, przedział (INT/4)×5 ft, ×2 dla rzeczy lżejszej niż ⅛ udźwigu
 *     (INT poniżej 4 — przedział 0, nie da się rzucić), test Explosives,
 *   - broń trzymana telekinezą: biała broń i walka wręcz dodają INT zamiast STR; z samą Telekinezą (poziom 0)
 *     INT bez mnożnika z rangi, z Mighty Telekinesis — mnożony jak STR,
 *   - kilka broni naraz (jak siodło): każda dodatkowa −1 krok MFD i +10 AP SATS, baza — najdroższa broń,
 *   - każde pełne 100 lb rzucanej rzeczy to dodatkowa akcja.
 */
export const MIGHTY_MULT = [2, 6, 18, 250, 250];
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4 };

/** Zaklęcia telekinezy z listy przedmiotów: { known, mighty (0–4), long, precision }. */
export function tkSpells(items = []) {
  const out = { known: false, mighty: 0, long: false, precision: false };
  for (const i of items) {
    if (i?.type !== "spell" || (i.system?.tradition ?? "unicorn") !== "unicorn") continue;
    const n = String(i.name ?? "").toLowerCase();
    if (/^telekinesis\b|^telekineza\b/.test(n)) out.known = true;
    const m = n.match(/^mighty telekinesis\s+(iv|iii|ii|i)\b/);
    if (m) { out.known = true; out.mighty = Math.max(out.mighty, ROMAN[m[1]]); }
    if (/^long.?ranged telekinesis/.test(n)) { out.known = true; out.long = true; }
    if (/^telekinetic precision/.test(n)) out.precision = true;
  }
  return out;
}

/** Udźwig, zasięg i rzut telekinezą dla danego INT. */
export function tkInfo({ int = 0, mighty = 0, long = false } = {}) {
  const i = Math.max(0, Number(int) || 0);
  const lift = (MIGHTY_MULT[mighty] ?? 2) * i;
  const inc = Math.floor(i / 4) * 5;
  return {
    int: i, mighty, long, lift, range: (long ? 50 : 5) * i,
    throwLimit: lift / 4, lightLimit: lift / 8, throwInc: inc, throwIncLight: inc * 2, canThrow: inc > 0
  };
}

/** Ile akcji zajmuje rzut rzeczą o tej wadze: 1 + po jednej za każde pełne 100 lb. */
export const throwActions = weight => 1 + Math.floor(Math.max(0, Number(weight) || 0) / 100);

/** Wartość „STR” w formule broni trzymanej telekinezą: INT, mnożone z rangi tylko z Mighty Telekinesis. */
export const tkDamageStat = ({ int = 0, mighty = 0, factor = 1 }) => (mighty > 0 ? int * factor : int);

/** Salwa z broni trzymanych telekinezą: kara w krokach MFD i koszt SATS. */
export function tkVolley(weapons = []) {
  const n = weapons.length;
  const base = Math.max(0, ...weapons.map(w => Number(w?.system?.satsCost ?? w?.satsCost) || 0));
  return { count: n, steps: Math.max(0, n - 1), satsCost: base + 10 * Math.max(0, n - 1) };
}

/** Broń naturalna (kopyta, róg, skrzydła, pazury, ugryzienie) — nie trzyma się jej telekinezą. */
export const isNaturalWeapon = w => {
  const s = w?.system ?? w ?? {};
  if (/^(hooves|horns?\b|horn\(s\)|wings|claws|bite|tail|kopyt|róg|rogi|skrzyd|pazur|ugryz|ogon)/i.test(String(w?.name ?? ""))) return true;
  return s.skill === "unarmed" && !(Number(s.weight) > 0) && !(Number(s.value) > 0);
};
