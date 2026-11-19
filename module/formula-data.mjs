/**
 * Formuły obrażeń (bez Foundry — testowalne w Node). Zapis jak w podręczniku: „3d4 + STR”, „4d4 + 2*STR”.
 * Rozpoznawane słowa (WIELKIMI literami, żeby nie myliły się z kośćmi):
 *   atrybuty: STR PER END CHA INT AGI LUCK, po polsku SIŁ (SIL) WYT ZRĘ (ZRE) SZC (SZCZ), też PER CHA INT,
 *   umiejętności: klucz WIELKIMI literami (MELEE, SMALLGUNS, MAGIC…) = ranga, z „10” na końcu = ranga/10 w dół
 *   (MELEE10, MAGIC10), poziom: LVL (LEVEL, POZ).
 * Funkcje kości Foundry działają same: floor(), ceil(), round(), min(), max(), abs().
 * STR w broni do walki wręcz liczy combat.mjs (mnożnik z rangi); tu — pozostałe słowa, dodawane wprost.
 */
export const ATTR_TOKENS = {
  STR: "str", SIL: "str", "SIŁ": "str", PER: "per", END: "end", WYT: "end", CHA: "cha",   // pl-ok: polskie skróty atrybutów
  INT: "int", AGI: "agi", ZRE: "agi", "ZRĘ": "agi", LUCK: "luck", LCK: "luck", SZC: "luck", SZCZ: "luck"   // pl-ok
};
export const LEVEL_TOKENS = ["LVL", "LEVEL", "POZ"];   // pl-ok: „POZ” = poziom
export const FUNCTIONS = ["floor", "ceil", "round", "min", "max", "abs"];

const L = "A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9_";   // pl-ok: litery słów
// słowo nie może sąsiadować z literą — wyjątek: „d” z cyfrą po nim (MELEE10d6 = tyle kości, ile ranga/10)
const word = w => new RegExp(`(?<![${L}])${w}(?=d\\d|[^${L}]|$)`, "g");

/**
 * Podstaw wartości w formule. vals: { attrs: {str: 5…}, skills: {melee: 60…}, level }.
 * skip — atrybuty pominięte (np. ["str"], gdy STR liczy już broń). Zwraca { formula, used: ["AGI 6", …] }.
 */
export function resolveFormula(formula, vals = {}, { skip = [] } = {}) {
  let f = String(formula ?? "");
  const used = [];
  const attrs = vals.attrs ?? {}, skills = vals.skills ?? {};
  // najpierw dłuższe słowa (SZCZ przed SZC, MELEE10 przed MELEE)
  const skillKeys = Object.keys(skills).sort((a, b) => b.length - a.length);
  for (const k of skillKeys) {
    const tok = k.toUpperCase();
    const rank = Number(skills[k]) || 0;
    f = f.replace(word(`${tok}10`), () => { used.push(`${tok}10 ${Math.floor(rank / 10)}`); return String(Math.floor(rank / 10)); });
    f = f.replace(word(tok), () => { used.push(`${tok} ${rank}`); return String(rank); });
  }
  for (const tok of Object.keys(ATTR_TOKENS).sort((a, b) => b.length - a.length)) {
    const key = ATTR_TOKENS[tok];
    if (skip.includes(key)) continue;
    const v = Number(attrs[key]) || 0;
    f = f.replace(word(tok), () => { used.push(`${tok} ${v}`); return String(v); });
  }
  for (const tok of LEVEL_TOKENS) {
    const v = Number(vals.level) || 0;
    f = f.replace(word(tok), () => { used.push(`${tok} ${v}`); return String(v); });
  }
  return { formula: f, used: [...new Set(used)] };
}

/** Słowa w formule, których nie rozpoznano (zostały WIELKIE litery) — do ostrzeżenia w podglądzie. */
export function unknownTokens(formula) {
  return [...new Set((String(formula ?? "").match(new RegExp(`(?<![${L}])[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ0-9_]+(?![${L}])`, "g")) ?? []))];   // pl-ok
}

/** Wartości postaci do formuł (z prepareDerivedData). */
export function formulaVals(sys = {}) {
  return {
    attrs: Object.fromEntries(Object.entries(sys.attributes ?? {}).map(([k, a]) => [k, a?.total ?? a?.value ?? 0])),
    skills: Object.fromEntries(Object.entries(sys.skills ?? {}).map(([k, s]) => [k, s?.rank ?? 0])),
    level: sys.level ?? 1
  };
}
