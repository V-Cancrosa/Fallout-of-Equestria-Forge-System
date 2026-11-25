/**
 * Cechy (traits) i wady (hindrances) z kreatora nadawane przez MG z katalogu — już po stworzeniu postaci.
 * Przykład: postać wychowała się w Stajni, ale gracz nie kupił Stable Dweller w kreatorze — MG nadaje ją za darmo.
 *
 * Przedmiot jest taki sam jak z kreatora (featureItem: nazwa, rodzaj, opis, efekty, wybory), ale:
 *   - bez kosztu w punktach tworzenia (flaga gmGrant) — kreator go nie liczy, nie usuwa i nie pozwala kupić drugi raz,
 *   - ograniczenia z podręcznika (creation-limits.mjs) są tylko ostrzeżeniami — MG decyduje,
 *   - jednorazowe efekty z tworzenia postaci (kapsle, karma) — tylko gdy MG zaznaczy.
 */
import { RACES, HINDRANCES, TRAITS } from "./creation-data.mjs";
import { resolveFeature, choiceState, featureItem } from "./creator-logic.mjs";
import { evalLimit } from "./creation-limits.mjs";
import { SKILLS } from "./data.mjs";
import { CREATION_ONLY } from "./effects.mjs";
import { isGM } from "./permissions.mjs";
import { t } from "./i18n.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const F = "foe-rpg";
const ref = e => `${e.kind === "hindrance" ? "h" : "t"}:${e.key}`;

/** Lista do katalogu: najpierw cechy, potem wady (etykiety tłumaczone przy odczycie). */
export function featureEntries() {
  return [
    ...Object.entries(TRAITS).map(([key, def]) => ({ key, kind: "trait", def, get name() { return def.label; } })),
    ...Object.entries(HINDRANCES).map(([key, def]) => ({ key, kind: "hindrance", def, get name() { return def.label; } }))
  ];
}

const readJson = (actor, key) => {
  try { return JSON.parse(actor.getFlag(F, key) || "{}"); } catch { return {}; }
};

/** Rasa postaci (klucz RACES): z zapisu kreatora, inaczej po nazwie rasy na karcie. */
function raceKeyOf(actor) {
  const saved = readJson(actor, "creation").race || readJson(actor, "npcCreation").race;
  if (saved && RACES[saved]) return saved;
  const name = String(actor.system?.race ?? "").trim().toLowerCase();
  return Object.keys(RACES).find(k => String(RACES[k].label).toLowerCase() === name) ?? "";
}

/** Przedmiot-cecha postaci odpowiadający cesze/wadzie (z kreatora, nadany przez MG albo dodany ręcznie pod tą nazwą). */
function ownedItem(actor, kind, key) {
  const def = (kind === "hindrance" ? HINDRANCES : TRAITS)[key];
  const label = def?.label?.toLowerCase();
  return actor.items.find(i => {
    if (i.type !== "feature") return false;
    const src = i.flags?.[F]?.source;
    if (src) return src === `${kind}:${key}`;
    const n = i.name.toLowerCase();
    return !!label && (n === label || n.startsWith(`${label} (`));
  }) ?? null;
}

/** Kontekst ograniczeń (creation-limits.mjs) dla gotowej postaci. */
export function actorLimitCtx(actor) {
  const raceKey = raceKeyOf(actor);
  const race = RACES[raceKey] ?? { manual: true };   // nieznana rasa — bez ograniczeń rasowych
  const orgItem = ownedItem(actor, "trait", "organization");
  const org = orgItem ? (orgItem.flags?.[F]?.choices?.org || readJson(actor, "creation").choices?.["t:organization"]?.org || "") : "";
  const has = r => {
    const [kind, key] = r.split(":");
    if (kind === "h") return !!ownedItem(actor, "hindrance", key);
    if (kind === "t") return !!ownedItem(actor, "trait", key);
    if (kind === "org") return org === key;
    if (kind === "race") return raceKey === key;
    return false;
  };
  const label = r => {
    const [kind, key] = r.split(":");
    if (kind === "h") return HINDRANCES[key]?.label ?? key;
    if (kind === "t") return TRAITS[key]?.label ?? key;
    if (kind === "race") return RACES[key]?.label ?? key;
    if (kind === "org") return TRAITS.organization.choices[0].options.find(o => o.v === key)?.label ?? key;
    return key;
  };
  const sys = actor.system ?? {};
  const attrs = Object.fromEntries(Object.entries(sys.attributes ?? {}).map(([k, a]) => [k, Number(a?.total ?? a?.value) || 0]));
  const tags = Object.entries(sys.skills ?? {}).filter(([, s]) => s?.tag).map(([k]) => k);
  return { raceKey, race, has, label, raceLabel: k => RACES[k]?.label ?? k, skillLabel: k => SKILLS[k]?.label ?? k, attrs, tags };
}

/** Wszystkie zastrzeżenia (rasa, wykluczenia, wymagania, zgoda MG) — jako lista ostrzeżeń. */
function warningsFor(refs, ctx) {
  const out = [];
  for (const r of refs) {
    const L = evalLimit(r, ctx);
    for (const why of [...L.block, ...L.need, ...L.gm]) out.push(`${ctx.label(r)}: ${why}`);
  }
  return out;
}

/** Status wiersza katalogu: { has, warn } — do kolumny „Status”. */
export function grantStatus(actor, entry) {
  if (!actor) return null;
  if (ownedItem(actor, entry.kind, entry.key)) return { has: true, warn: [] };
  const ctx = actorLimitCtx(actor);
  const L = evalLimit(ref(entry), ctx);
  return { has: false, warn: [...L.block, ...L.need, ...L.gm] };
}

/** Wybory cechy jako pola formularza (c<indeks> — Organization ma kilka wyborów o tym samym id, pokazywanych warunkowo). */
function choicesHtml(def, ctx, isOrg) {
  return (def.choices ?? []).map((c, idx) => {
    const opts = c.options.map(o => {
      const L = isOrg && c.id === "org" ? evalLimit(`org:${o.v}`, ctx) : null;
      const why = L ? [...L.block, ...L.need].join("; ") : "";
      return { ...o, why };
    });
    const body = c.type === "many"
      ? `<div class="gf-many">${opts.map(o => `<label><input type="checkbox" name="c${idx}" value="${esc(o.v)}"> ${esc(o.label)}</label>`).join("")}</div>`
      : `<select name="c${idx}"><option value="">${esc(t("— choose —"))}</option>${opts.map(o => `<option value="${esc(o.v)}" ${o.why ? `title="${esc(o.why)}"` : ""}>${esc(o.label)}${o.why ? " ⚠" : ""}</option>`).join("")}</select>`;
    const n = c.type === "many" ? (typeof c.pick === "function" ? "" : ` (${c.pick})`) : "";
    return `<div class="atk-row gf-choice" data-idx="${idx}"><span>${esc(c.label)}${n}</span> ${body}</div>`;
  }).join("");
}

/** Odczyt wyborów z formularza: tylko widoczne (jak choiceState), wynik { id: wartość | [wartości] }. */
function readChoices(def, form) {
  const raw = {};
  (def.choices ?? []).forEach((c, idx) => {
    if (c.show && !c.show(raw)) return;
    raw[c.id] = c.type === "many"
      ? [...form.querySelectorAll(`[name=c${idx}]:checked`)].map(el => el.value)
      : form.querySelector(`[name=c${idx}]`)?.value ?? "";
  });
  return raw;
}

/**
 * MG nadaje postaci cechę lub wadę z kreatora — za darmo, bez punktów tworzenia.
 * entry: { kind: "trait" | "hindrance", key }.
 */
export async function grantFeature(actor, entry) {
  if (!isGM()) return ui.notifications.warn(t("Only the GM grants traits and hindrances."));
  if (!actor) return null;
  const kind = entry.kind === "hindrance" ? "hindrance" : "trait";
  const def = (kind === "hindrance" ? HINDRANCES : TRAITS)[entry.key];
  if (!def) return null;
  if (ownedItem(actor, kind, entry.key)) return ui.notifications.info(t("{name} already has {what}.", { name: actor.name, what: def.label }));

  const ctx = actorLimitCtx(actor);
  const isOrg = kind === "trait" && entry.key === "organization";
  const baseWarn = warningsFor([`${kind === "hindrance" ? "h" : "t"}:${entry.key}`], ctx);
  // jednorazowe efekty z tworzenia postaci (kapsle, karma) — tylko gdy cecha może je dać
  const oneTime = (def.fx ?? []).some(e => CREATION_ONLY.has(e.type)) || !!def.resolve;
  const content = `<div class="foe-dialog foe-grant">
    <p><b>${esc(def.label)}</b> — ${esc(kind === "hindrance" ? t("Hindrance") : t("Trait"))}${def.type ? ` (${esc(def.type)})` : ""}</p>
    <p class="hint">${esc(def.desc)}</p>
    ${choicesHtml(def, ctx, isOrg)}
    <p class="gf-warn warn" ${baseWarn.length ? "" : "hidden"}><i class="fa-solid fa-triangle-exclamation"></i> <span>${esc(baseWarn.join("; "))}</span></p>
    ${oneTime ? `<label class="atk-row"><input type="checkbox" name="oneTime"> ${esc(t("Also apply the one-time creation effects (caps, karma)"))}</label>` : ""}
    <p class="hint">${esc(t("Granted by the GM: no creation points are spent or gained; the character creator leaves it alone. Rulebook restrictions are only warnings — you decide."))}</p>
  </div>`;

  const render = (ev, dlg) => {
    const form = dlg.element.querySelector("form") ?? dlg.element;
    const update = () => {
      // widoczność wyborów warunkowych (Organization: umiejętność zależy od organizacji)
      const raw = {};
      (def.choices ?? []).forEach((c, idx) => {
        const row = form.querySelector(`.gf-choice[data-idx="${idx}"]`);
        const visible = !c.show || c.show(raw);
        if (row) row.hidden = !visible;
        if (!visible) return;
        raw[c.id] = c.type === "many" ? [...form.querySelectorAll(`[name=c${idx}]:checked`)].map(el => el.value) : form.querySelector(`[name=c${idx}]`)?.value ?? "";
      });
      const warn = [...baseWarn, ...(isOrg && raw.org ? warningsFor([`org:${raw.org}`], ctx) : [])];
      const box = form.querySelector(".gf-warn");
      if (box) { box.hidden = !warn.length; box.querySelector("span").textContent = warn.join("; "); }
    };
    form.addEventListener("change", update);
    update();
  };

  let res;
  for (;;) {
    res = await foundry.applications.api.DialogV2.wait({
      window: { title: t("Grant: {what}", { what: def.label }), icon: "fa-solid fa-user-shield" },
      classes: ["foe-rpg", "foe-roll-dialog"], position: { width: 480 }, rejectClose: false, content, render,
      buttons: [
        { action: "ok", label: t("Grant (GM)"), icon: "fa-solid fa-check", default: true,
          callback: (ev, btn) => ({ raw: readChoices(def, btn.form), oneTime: !!btn.form.elements.oneTime?.checked }) },
        { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" }
      ]
    });
    if (!res || typeof res !== "object") return null;
    const { missing } = choiceState(def, res.raw);
    if (!missing.length) break;
    ui.notifications.warn(t("{name}: choose {what}.", { name: def.label, what: missing.join(", ").toLowerCase() }));
  }

  const f = resolveFeature(kind, entry.key, def, res.raw);
  const itemData = featureItem(f, { gm: true });
  const [item] = await actor.createEmbeddedDocuments("Item", [itemData]);

  // jednorazowe: kapsle i karma (jak przy tworzeniu postaci)
  const sum = type => f.fx.filter(e => e.type === type && !e.when).reduce((s, e) => s + (Number(e.value) || 0), 0);
  const caps = sum("caps"), karma = sum("karma");
  const applied = [];
  if (res.oneTime && (caps || karma)) {
    const upd = {};
    if (caps) { upd["system.caps"] = Math.max(0, (Number(actor.system.caps) || 0) + caps); applied.push(t("caps {n}", { n: caps > 0 ? `+${caps}` : caps })); }
    if (karma) { upd["system.karma"] = (Number(actor.system.karma) || 0) + karma; applied.push(t("karma {n}", { n: karma > 0 ? `+${karma}` : karma })); }
    await actor.update(upd);
  }

  const warns = [...baseWarn, ...(isOrg && f.ch.org ? warningsFor([`org:${f.ch.org}`], ctx) : [])];
  const msg = t("{name}: {what} granted by the GM (no creation points).", { name: actor.name, what: item?.name ?? def.label })
    + (applied.length ? ` ${t("Applied: {list}.", { list: applied.join(", ") })}` : "")
    + (warns.length ? ` ${t("Note: {w}.", { w: warns.join("; ") })}` : "");
  ui.notifications[warns.length ? "warn" : "info"](msg);
  return item;
}
