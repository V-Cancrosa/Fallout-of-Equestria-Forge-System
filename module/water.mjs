/**
 * Okno pojemnika na wodę (manierka, butelka): napij się, napełnij z ekwipunku albo ze źródła, wylej.
 * Zawartość i pojemność — water-data.mjs; skutki picia — survival.mjs (drinkWater).
 */
import { t } from "./i18n.mjs";
import { stackCapacity, waterOf, pour } from "./water-data.mjs";
import { foodInfo } from "./survival-data.mjs";
import { itemTaint } from "./taint-data.mjs";
import { drinkWater } from "./survival.mjs";
import { gearItem } from "./catalog-data.mjs";

const F = "foe-rpg";
const { DialogV2 } = foundry.applications.api;
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
/** Źródła wody (katalog): rzeka, kałuża, kran w Stajni… — MG mówi, jaka to woda. */
const SOURCES = ["Dirty Water", "Purified Water", "Weed Water"];

const radsOf = desc => foodInfo(desc).rads;
/** Napoje w ekwipunku, które można przelać (nawadniające, nie odwadniające). */
const drinksOf = actor => (actor.items ?? []).filter(i => {
  if (i.type !== "gear" || i.system?.category !== "food" || (Number(i.system.qty) || 0) < 1) return false;
  const info = foodInfo(i.system.description);
  return info.drink && info.hydrate && !info.dehydrating;
});

/** Etykieta przycisku przy pojemniku w ekwipunku: „Woda 2/4”. */
export function waterLabel(item) {
  const cap = stackCapacity(item);
  return cap ? t("Water {n}/{cap}", { n: waterOf(item)?.n ?? 0, cap }) : "";
}

async function sourceDrink(name) {
  try {
    const { loadCatalog } = await import("./catalog.mjs");
    const entry = (await loadCatalog()).gear?.find(e => e.name === name);
    if (entry) return { name, desc: gearItem(entry).system.description, taint: 0 };
  } catch (err) { console.warn(`${F} | water source`, err); }
  return { name, desc: name === "Dirty Water" ? "+10 Rads" : "", taint: 0 };
}

export async function openWaterDialog(actor, item) {
  if (!actor?.isOwner) return ui.notifications.warn(t("You don't own: {name}.", { name: actor?.name ?? "?" }));
  const cap = stackCapacity(item);
  const w = waterOf(item);
  const free = cap - (w?.n ?? 0);
  const drinks = drinksOf(actor);
  const now = w ? t("{n} of {cap} portions: {what}", { n: w.n, cap, what: esc(w.name) }) : t("Empty ({cap} portions fit).", { cap });
  const content = `<div class="foe-dialog">
    <div class="atk-info"><div><b>${esc(item.name)}</b> — ${now}</div></div>
    ${free > 0 && drinks.length ? `<label class="mod-row">${t("Pour from your gear")}
      <select name="from">${drinks.map(d => `<option value="${d.id}">${esc(d.name)} ×${d.system.qty}</option>`).join("")}</select></label>` : ""}
    ${free > 0 ? `<label class="mod-row">${t("Fill at a source (the GM says what water it is)")}
      <select name="src">${SOURCES.map(s => `<option value="${s}">${esc(s)}</option>`).join("")}</select></label>
      <label class="mod-row">${t("Portions")} <input type="number" name="n" value="${free}" min="1" max="${free}"></label>` : ""}
    <p class="hint">${t("A portion is a quarter of a day's water (p. 218) and weighs 1 lb. Mixed water counts as the worse one (rads, taint). During a time skip characters also drink from their canteens.")}</p>
  </div>`;
  const buttons = [];
  if (w) buttons.push({ action: "drink", label: t("Drink"), icon: "fa-solid fa-droplet", default: true });
  if (free > 0 && drinks.length) buttons.push({ action: "gear", label: t("Pour from gear"), icon: "fa-solid fa-bottle-water" });
  if (free > 0) buttons.push({ action: "source", label: t("Fill at the source"), icon: "fa-solid fa-faucet-drip", default: !w });
  if (w) buttons.push({ action: "empty", label: t("Empty it"), icon: "fa-solid fa-trash" });
  const r = await DialogV2.wait({
    window: { title: item.name }, classes: ["foe-rpg", "foe-roll-dialog"], position: { width: 420 }, content, rejectClose: false,
    buttons: buttons.map(b => ({ ...b, callback: (ev, btn) => ({ act: b.action, from: btn.form.elements.from?.value, src: btn.form.elements.src?.value, n: Number(btn.form.elements.n?.value) || free }) }))
  });
  if (!r) return;
  if (r.act === "drink") return drinkWater(actor, item);
  if (r.act === "empty") {
    await item.unsetFlag(F, "water");
    return ui.notifications.info(t("{name}: emptied.", { name: item.name }));
  }
  let drink, source = null;
  if (r.act === "gear") {
    source = actor.items.get(r.from);
    if (!source) return;
    drink = { name: source.name, desc: source.system.description, taint: itemTaint(source) };
  } else drink = await sourceDrink(r.src);
  const want = r.act === "gear" ? Math.min(Number(source.system.qty) || 0, free, Math.max(1, r.n)) : Math.max(1, Math.min(free, r.n));
  const { water, poured } = pour(w, drink, want, cap, radsOf);
  if (!poured) return;
  await item.update({ [`flags.${F}.water`]: water });
  if (source) await source.update({ "system.qty": Math.max(0, (Number(source.system.qty) || 0) - poured) });
  ui.notifications.info(t("{name}: +{n} portions of {what} ({have}/{cap}).", { name: item.name, n: poured, what: drink.name, have: water.n, cap }));
}
