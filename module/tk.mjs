/**
 * Telekineza postaci (Foundry, bez innych zależności — importują ją rzuty, atak, karta i rzucanie przedmiotów).
 * Reguły i liczby: tk-data.mjs.
 */
import { tkSpells, tkInfo, isNaturalWeapon } from "./tk-data.mjs";

const F = "foe-rpg";

/** Czy postać użyje telekinezy: rzuca zaklęcia jednorożców, zna telekinezę i nie ma wypalenia. */
export const knowsTK = actor => !!actor?.system?.caster && !actor.system.burnout && tkSpells(actor.items ?? []).known;

/** Udźwig, zasięg i rzut telekinezą postaci. */
export const tkOf = actor => {
  const s = tkSpells(actor?.items ?? []);
  return { ...tkInfo({ int: actor?.system?.attributes?.int?.total ?? 0, mighty: s.mighty, long: s.long }), ...s, usable: knowsTK(actor) };
};

/** Czy broń da się trzymać telekinezą (zna TK, broń nie jest naturalna ani zamontowana na siodle). */
export const canHoldByTK = (actor, item) => item?.type === "weapon" && !isNaturalWeapon(item) && !item.system?.mounted && knowsTK(actor);

/** Czy broń jest trzymana telekinezą: flaga foe-rpg.tk; bez flagi — tak, gdy da się (domyślnie włączone). */
export function heldByTK(actor, item) {
  if (!canHoldByTK(actor, item)) return false;
  const f = item.flags?.[F]?.tk;
  return f === undefined ? true : !!f;
}
