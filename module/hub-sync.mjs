/**
 * Synchronizacja z zewnętrznym HUB-em graczy (np. strona drużyny poza Foundry): po każdej zmianie postaci
 * przeglądarka MG wysyła jej migawkę — wartości już policzone tak, jak widać je na karcie (rangi, MFD, SATS, rany,
 * wygląd z drabinki) — na adres HUB-a.
 *   - Adres HUB-a: ustawienie świata „hubUrl”. Pusty — synchronizacja wyłączona.
 *   - Klucz: ustawienie klienta „hubToken” — zapisane tylko w przeglądarce, która je wpisała (MG). Gracze go nie znają,
 *     więc nie mogą podszyć się pod Foundry.
 *   - Wysyła tylko aktywny MG (przy kilku MG — jeden), tylko postacie (typ „character”), zbiorczo co kilka sekund.
 * HUB przyjmuje POST {adres}/api/foundry/postacie z nagłówkiem Authorization: Bearer {klucz}
 * i treścią { world, characters: [migawka, …] }.
 */
import { t } from "./i18n.mjs";
import { ATTRS } from "./data.mjs";
import { skinOf } from "./skins.mjs";
import { taintState } from "./taint.mjs";
import { hitTableFor, tableLocations } from "./combat.mjs";

const F = "foe-rpg";
const DELAY = 3000;
const pending = new Set();
let timer = null;
let warned = false;

export function registerHubSyncSettings() {
  game.settings.register(F, "hubUrl", {
    name: "Player hub: address",
    hint: "Address of an external player hub (e.g. https://example.workers.dev). When set, the GM's browser sends character sheets there after every change. Empty — off.",
    scope: "world", config: true, type: String, default: ""
  });
  game.settings.register(F, "hubToken", {
    name: "Player hub: sync key (GM only)",
    hint: "The key the hub expects. Stored only in this browser — the GM fills it in, players leave it empty.",
    scope: "client", config: true, type: String, default: ""
  });
}

const isPc = actor => actor?.type === "character";
const activeGm = () => game.user?.isGM && (game.users?.activeGM ? game.users.activeGM.isSelf : true);

export function registerHubSyncHooks() {
  Hooks.once("ready", () => {
    if (!game.user?.isGM) return;
    const actorOf = doc => (isPc(doc) ? doc : isPc(doc?.parent) ? doc.parent : null);
    for (const hook of ["createActor", "updateActor", "createItem", "updateItem", "deleteItem", "updateActiveEffect"]) {
      Hooks.on(hook, doc => queue(actorOf(doc)));
    }
    // przy starcie świata: wszystkie postacie naraz (HUB dostaje stan po przerwie)
    setTimeout(() => game.actors?.filter(isPc).forEach(queue), 5000);
  });
}

function queue(actor) {
  if (!actor || !activeGm()) return;
  pending.add(actor.id);
  clearTimeout(timer);
  timer = setTimeout(flush, DELAY);
}

async function flush() {
  const base = String(game.settings.get(F, "hubUrl") ?? "").trim().replace(/\/+$/, "");
  const token = String(game.settings.get(F, "hubToken") ?? "").trim();
  const ids = [...pending];
  pending.clear();
  if (!base || !token || !ids.length) return;
  const characters = ids.map(id => game.actors.get(id)).filter(isPc).map(snapshot);
  if (!characters.length) return;
  try {
    const res = await fetch(`${base}/api/foundry/postacie`, { // pl-ok: ścieżka API HUB-a
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ world: game.world?.id ?? "", characters })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    warned = false;
  } catch (err) {
    console.warn("foe-rpg | player hub sync failed", err);
    if (!warned) ui.notifications?.warn(t("Player hub: could not send the character sheets ({error}).", { error: err.message }));
    warned = true;
  }
}

const absolute = path => {
  if (!path) return "";
  try { return new URL(path, window.location.href).href; } catch { return ""; }
};
const plain = html => {
  const div = document.createElement("div");
  div.innerHTML = String(html ?? "");
  return div.textContent.replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000);
};
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj?.[k]]));

/**
 * Lokacje jak na sylwetce karty (sheets.mjs): z tabeli trafień rasy, a skrzydła i róg także bez nich w tabeli,
 * gdy mają rany albo DT (np. proteza skrzydła).
 */
function bodyLocations(s) {
  const locs = tableLocations(hitTableFor(s.race)).filter(k => s.locations[k]);
  for (const k of ["wings", "horn"]) if (!locs.includes(k) && (s.locations[k]?.wounds || s.locations[k]?.dt)) locs.push(k);
  return locs;
}

/** Migawka postaci: tylko dane do pokazania (bez identyfikatorów użytkowników Foundry). */
export function snapshot(actor) {
  const s = actor.system;
  const items = [...actor.items];
  const r = s.resources;
  return {
    id: actor.id,
    name: actor.name,
    img: absolute(actor.img),
    skin: skinOf(actor),
    race: s.race, level: s.level, xp: s.xp, karma: s.karma, caps: s.caps,
    cutieMark: absolute(s.cutieMark), cutieMarkText: s.cutieMarkText,
    resources: {
      sats: pick(r.sats, ["value", "max"]),
      luck: pick(r.luck, ["value", "max"]),
      strain: { value: r.strain.value, max: s.strainMax ?? r.strain.max },
      rads: pick(r.rads, ["value", "max"])
    },
    attributes: Object.fromEntries(Object.keys(ATTRS).map(k => [k, { value: s.attributes[k].total, tn: s.attributes[k].tn }])),
    // umiejętności rasowe (Magic, Flight, Dig) — tylko te, które rasa zna, jak na karcie
    skills: Object.fromEntries(Object.entries(s.skills)
      .filter(([, sk]) => sk.known !== false)
      .map(([k, sk]) => [k, { attr: sk.attr, tag: sk.tag, rank: sk.rank, tn: sk.tn }])),
    locations: Object.fromEntries(bodyLocations(s)
      .map(k => [k, s.locations[k]])
      .map(([k, l]) => [k, { wounds: l.wounds, limit: l.limit, status: l.status, dt: l.dtTotal }])),
    derived: {
      carry: s.carry, weight: s.weight, speed: s.speed, sneakSpeed: s.sneakSpeed, dmgPerWound: s.dmgPerWound,
      totalWounds: s.totalWounds, radResist: s.radResistTotal, initMod: s.initMod
    },
    taint: pick(taintState(actor), ["pos", "alicorn"]),
    features: items.filter(i => i.type === "feature").map(i => ({ name: i.name, kind: i.system.kind, active: i.system.active !== false })),
    spells: items.filter(i => i.type === "spell").map(i => ({ name: i.name })),
    weapons: items.filter(i => i.type === "weapon").map(i => ({ name: i.name, qty: i.system.qty ?? 1 })),
    armor: items.filter(i => i.type === "armor").map(i => ({ name: i.name, equipped: !!i.system.equipped, dt: i.system.dt })),
    gear: items.filter(i => i.type === "gear").map(i => ({ name: i.name, qty: i.system.qty ?? 1 })),
    notes: plain(s.notes),
    updated: new Date().toISOString()
  };
}
