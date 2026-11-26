/**
 * Inicjatywa i tracker walki (podręcznik s. 436–437).
 *   - d100 ± próg AGI ¼ (gracz wybiera po rzucie: odjąć = szybciej, dodać = później) − premie z cech; niższy działa pierwszy,
 *   - 2 akcje na turę (licznik w trackerze, atak i przeładowanie odhaczają same),
 *   - runda zaskoczenia: zaskoczeni nie działają, atakujący mają 1 akcję, potem wszyscy rzucają od nowa,
 *   - opcjonalnie: ten sam rząd dziesiątek = akcje jednoczesne.
 */

const { DialogV2 } = foundry.applications.api;
import { clearFlag } from "./flags.mjs";
import { t } from "./i18n.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const signed = n => (n > 0 ? `+${n}` : `${n}`).replace("-", "−");
const F = "foe-rpg";

/** Ile akcji ma walczący w tej rundzie. */
export function maxActions(combat, combatant) {
  if (combat?.getFlag(F, "surprise")) return combatant.getFlag(F, "surprised") ? 0 : 1;
  return 2;
}
const usedActions = c => Number(c.getFlag(F, "used")) || 0;

const SOCKET = `system.${F}`;

/**
 * Karta inicjatywy na czacie (s. 436): najpierw d100, potem właściciel postaci (albo MG) wybiera na karcie,
 * ile z progu AGI ¼ odjąć albo dodać. Do wyboru tracker pokazuje wariant najszybszy (−¼).
 * data: { combat, combatant, name, d100, q, fx, mod } — mod null = jeszcze nie wybrano.
 */
export function initCardHtml(data) {
  const { name, d100, q, fx } = data;
  const chosen = data.mod !== null && data.mod !== undefined;
  const mod = chosen ? data.mod : -q;
  const total = d100 + mod - fx;
  const sum = `d100 ${d100}${q || chosen ? ` ${mod < 0 ? "−" : "+"} ${Math.abs(mod)} (AGI ¼)` : ""}${fx ? ` ${signed(-fx)} (${t("traits")})` : ""}`;
  const buttons = chosen || !q ? "" : `
    <div class="fc-init-pick">
      <button type="button" data-init="sub"><i class="fa-solid fa-forward"></i> ${t("Subtract → {n}", { n: d100 - q - fx })}</button>
      <button type="button" data-init="add"><i class="fa-solid fa-backward"></i> ${t("Add → {n}", { n: d100 + q - fx })}</button>
      <span class="fc-init-own"><input type="number" name="init-own" value="${-q}" min="${-q}" max="${q}" step="1" title="${t("Custom value (from −{q} to +{q})", { q })}">
      <button type="button" data-init="own"><i class="fa-solid fa-pen"></i> ${t("Custom")}</button></span>
    </div>
    <div class="fc-meta">${t("Choose before announcing: subtract up to AGI ¼ ({q}) to act sooner, add to wait (p. 436). Until then the tracker shows the fastest option.", { q })}</div>`;
  return `
    <div class="foe-card test">
      <div class="fc-tag"><span>${t("PIPBUCK // INITIATIVE")}</span><span>d100</span></div>
      <h3>${esc(name)}</h3>
      <div class="fc-main">
        <div class="fc-roll">${total}<small>${t("INIT.")}</small></div>
        <div class="fc-outcome">${!chosen && q ? t("Choose ± AGI") : mod < 0 ? t("Faster") : mod > 0 ? t("Waits") : t("Initiative")}</div>
        <div class="fc-sum">${sum}</div>
      </div>
      ${buttons}
      <div class="fc-meta">${t("Lower initiative acts earlier.")} ${t("Formula (p. 436): 1d100 ± AGI ¼, then trait and perk modifiers (Quick Witted…); each point of a temporary AGI penalty lowers the ¼ value by 5.")}</div>
    </div>`;
}

/** Zapis wyboru: inicjatywa walczącego i karta (gdy nie wolno edytować cudzej wiadomości — przez MG). */
async function applyInitChoice(message, mod) {
  const data = message.flags?.[F]?.init;
  if (!data) return;
  const q = Number(data.q) || 0;
  mod = Math.max(-q, Math.min(q, Math.round(Number(mod) || 0)));
  const combat = game.combats?.get(data.combat);
  const c = combat?.combatants.get(data.combatant);
  if (c) await c.update({ initiative: data.d100 + mod - (Number(data.fx) || 0) });
  const next = { ...data, mod };
  await message.update({ content: initCardHtml(next), [`flags.${F}.init`]: next });
}

function decorateInit(message, html) {
  const data = message.flags?.[F]?.init;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!data || !root) return;
  const box = root.querySelector(".fc-init-pick");
  if (!box) return;
  const c = game.combats?.get(data.combat)?.combatants.get(data.combatant);
  const may = game.user.isGM || !!c?.isOwner;
  if (!may || data.mod !== null && data.mod !== undefined) { box.remove(); return; }
  box.addEventListener("click", async ev => {
    const b = ev.target.closest("button[data-init]");
    if (!b) return;
    ev.preventDefault();
    const q = Number(data.q) || 0;
    const mod = b.dataset.init === "sub" ? -q : b.dataset.init === "add" ? q : Number(box.querySelector("input[name=init-own]")?.value);
    box.querySelectorAll("button").forEach(x => { x.disabled = true; });
    if (message.isOwner) await applyInitChoice(message, mod);
    else if (game.users.activeGM) game.socket.emit(SOCKET, { kind: "init-pick", msg: message.id, mod, user: game.user.id });
    else ui.notifications.warn(t("The GM must be online to save this choice."));
  });
}

/** W FoE RPG niższa inicjatywa działa pierwsza. */
/**
 * Przycisk „Inicjatywa” na karcie: dodaje token postaci do walki na tej scenie i rzuca (z wyborem ± AGI).
 * Gdy walki jeszcze nie ma, MG ją tworzy tym samym kliknięciem; gracz dostaje podpowiedź.
 */
export async function rollActorInitiative(actor) {
  const tokens = actor.getActiveTokens?.() ?? [];
  if (!tokens.length) return ui.notifications.warn(t("{name}: place this character's token on the scene to join the combat.", { name: actor.name }));
  if (!game.combat && !game.user.isGM) return ui.notifications.warn(t("There's no combat yet — the GM starts it in the combat tab (swords) or by clicking “Initiative” here."));
  const c = game.combat?.getCombatantsByActor?.(actor)?.[0];
  if (c && Number.isNumeric(c.initiative)) {
    const again = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("Initiative") }, content: `<p>${t("{name} already has initiative {n}. Roll again?", { name: foundry.utils.escapeHTML(actor.name), n: `<b>${c.initiative}</b>` })}</p>`
    });
    if (!again) return null;
  }
  return actor.rollInitiative({ createCombatants: true, rerollInitiative: true });
}

export class FoeCombat extends Combat {
  _sortCombatants(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : Infinity;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : Infinity;
    return (ia - ib) || (b.actor?.system.attributes?.agi.total ?? 0) - (a.actor?.system.attributes?.agi.total ?? 0)
      || (a.id > b.id ? 1 : -1);
  }

  /**
   * Rzut inicjatywy: d100, potem gracz wybiera ± AGI ¼ (MG za swoich NPC i przy „rzuć wszystkim” — odejmowanie).
   */
  async rollInitiative(ids, { updateTurn = true, messageOptions = {} } = {}) {
    ids = typeof ids === "string" ? [ids] : Array.from(ids ?? []);
    const currentId = this.combatant?.id;
    const ask = ids.length === 1 || !game.user.isGM;
    const updates = [];
    for (const id of ids) {
      const c = this.combatants.get(id);
      if (!c?.isOwner) continue;
      const sys = c.actor?.system;
      const q = sys?.initAgi ?? 0;
      const fx = sys?.initFx ?? 0;
      const roll = await new Roll("1d100").evaluate();
      const player = c.actor?.hasPlayerOwner;
      // wybór na karcie czatu: gracz zawsze; MG — przy rzucie jednej postaci. „Rzuć wszystkim” u MG — od razu −¼.
      const pick = !!q && ask && (player || !game.user.isGM);
      const data = { combat: this.id, combatant: id, name: c.name, d100: roll.total, q, fx, mod: pick ? null : -q };
      updates.push({ _id: id, initiative: roll.total - q - fx });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: c.actor, token: c.token, alias: c.name }),
        rolls: [roll],
        sound: CONFIG.sounds.dice,
        flavor: "",
        content: initCardHtml(data),
        flags: { [F]: { init: data } },
        ...messageOptions
      });
    }
    if (!updates.length) return this;
    await this.updateEmbeddedDocuments("Combatant", updates);
    if (updateTurn && currentId) await this.update({ turn: this.turns.findIndex(tr => tr.id === currentId) });
    return this;
  }
}

/** Odhacza akcje postaci w bieżącej walce (atak, przeładowanie, gaszenie). */
export async function spendActions(actor, n = 1, what = t("action")) {
  const combat = game.combat;
  if (!combat?.started || !actor) return;
  const c = combat.getCombatantsByActor?.(actor)?.[0] ?? combat.combatants.find(x => x.actor === actor);
  if (!c?.isOwner) return;
  const max = maxActions(combat, c);
  const used = usedActions(c);
  if (used + n > max) ui.notifications.warn(t("{name}: {what} — {left} of {max} actions left this round.", { name: c.name, what, left: Math.max(0, max - used), max }));
  await c.setFlag(F, "used", Math.min(max, used + n));
}

/** Okno rundy zaskoczenia: kto jest zaskoczony. */
async function startSurprise(combat) {
  const rows = combat.combatants.contents.map(c =>
    `<label class="atk-row atk-check"><input type="checkbox" name="s-${c.id}"><span>${esc(c.name)}</span><small>${t("tick if surprised")}</small></label>`).join("");
  const picked = await DialogV2.wait({
    window: { title: t("Surprise round") },
    classes: ["foe-rpg", "foe-roll-dialog"],
    position: { width: 420 },
    content: `<div class="foe-dialog">${rows}
      <p class="hint">${t("The surprised don't act and don't roll initiative. Attackers have 1 action each. When the round ends, everyone rolls initiative again.")}</p></div>`,
    rejectClose: false,
    buttons: [{ action: "ok", label: t("btn|Start"), icon: "fa-solid fa-eye-slash", default: true,
      callback: (ev, btn) => combat.combatants.contents.filter(c => btn.form.elements[`s-${c.id}`]?.checked).map(c => c.id) }]
  });
  if (!picked) return;
  await combat.updateEmbeddedDocuments("Combatant", combat.combatants.contents.map(c => ({
    _id: c.id, [`flags.${F}.surprised`]: picked.includes(c.id), [`flags.${F}.used`]: 0,
    ...(picked.includes(c.id) ? { initiative: null } : {})
  })));
  await combat.setFlag(F, "surprise", true);
  if (!combat.started) await combat.startCombat();
  ChatMessage.create({ content: `<div class="foe-card test"><div class="fc-tag"><span>${t("PIPBUCK // SURPRISE")}</span><span>${t("round {n}", { n: 1 })}</span></div>
    <div class="fc-meta">${t("Surprised: {list}. Attackers have 1 action each.", { list: picked.map(id => esc(combat.combatants.get(id)?.name)).join(", ") || t("nobody") })}</div></div>` });
}

export function registerTrackerHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    try { decorateInit(message, html); } catch (err) { console.warn(`${F} | initiative card`, err); }
  });
  Hooks.once("ready", () => {
    game.socket.on(SOCKET, async p => {
      if (p?.kind !== "init-pick" || !game.users.activeGM?.isSelf) return;
      const msg = game.messages.get(p.msg);
      const data = msg?.flags?.[F]?.init;
      const c = data && game.combats?.get(data.combat)?.combatants.get(data.combatant);
      const user = game.users.get(p.user);
      if (!msg || !c || !user || !c.testUserPermission(user, "OWNER") || (data.mod !== null && data.mod !== undefined)) return;
      await applyInitChoice(msg, p.mod);
    });
  });
  // Nowa runda: odnowione akcje; koniec rundy zaskoczenia → wszyscy rzucają inicjatywę od nowa
  Hooks.on("updateCombat", async (combat, changed, options) => {
    if (!("round" in changed) || !game.users.activeGM?.isSelf) return;
    const forward = options?.direction ? options.direction > 0 : changed.round > (combat.previous?.round ?? changed.round);
    if (!forward) return;
    const endSurprise = combat.getFlag(F, "surprise") && changed.round > 1;
    await combat.updateEmbeddedDocuments("Combatant", combat.combatants.contents.map(c => ({
      _id: c.id, [`flags.${F}.used`]: 0, ...(endSurprise ? { [`flags.${F}.surprised`]: false } : {})
    })));
    if (endSurprise) {
      await clearFlag(combat, "surprise");
      await combat.resetAll();
      ChatMessage.create({ content: `<div class="foe-card test"><div class="fc-tag"><span>${t("PIPBUCK // SURPRISE OVER")}</span><span>${t("round {n}", { n: changed.round })}</span></div>
        <div class="fc-meta">${t("Everyone rolls initiative again (the dice icon next to the name in the tracker).")}</div></div>` });
    }
  });

  Hooks.on("renderCombatTracker", (app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const combat = app.viewed ?? game.combat;
    if (!root || !combat) return;
    const tens = game.settings.get(F, "simultaneousTens");
    const groups = new Map();
    if (tens) for (const c of combat.combatants) {
      if (!Number.isNumeric(c.initiative)) continue;
      const g = Math.floor(c.initiative / 10);
      groups.set(g, (groups.get(g) ?? 0) + 1);
    }

    for (const li of root.querySelectorAll("[data-combatant-id]")) {
      const c = combat.combatants.get(li.dataset.combatantId);
      if (!c || li.querySelector(".foe-ct")) continue;
      const max = maxActions(combat, c);
      const used = usedActions(c);
      const box = document.createElement("div");
      box.className = "foe-ct";
      let html = "";
      if (combat.getFlag(F, "surprise") && c.getFlag(F, "surprised")) html += `<span class="foe-ct-tag surprised">${t("SURPRISED")}</span>`;
      else if (combat.started) {
        html += `<span class="foe-ct-pips" title="${t("Actions this round (click to tick off)")}">${Array.from({ length: max }, (_, i) =>
          `<a class="foe-pip ${i < used ? "used" : ""}" data-i="${i}"></a>`).join("")}</span>`;
      }
      if (tens && Number.isNumeric(c.initiative)) {
        const g = Math.floor(c.initiative / 10);
        if ((groups.get(g) ?? 0) > 1) html += `<span class="foe-ct-tag" title="${t("Same tens — simultaneous actions")}">⇄ ${g * 10}–${g * 10 + 9}</span>`;
      }
      if (!html) continue;
      box.innerHTML = html;
      box.addEventListener("click", async ev => {
        const pip = ev.target.closest(".foe-pip");
        if (!pip) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (!c.isOwner) return;
        const i = Number(pip.dataset.i);
        await c.setFlag(F, "used", i < usedActions(c) ? i : i + 1);
      });
      (li.querySelector(".token-name") ?? li).append(box);
    }

    if (game.user.isGM && !root.querySelector(".foe-surprise")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "foe-surprise";
      btn.title = t("Surprise round (p. 436)");
      btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> ${t("Surprise")}`;
      btn.addEventListener("click", () => startSurprise(combat));
      const bar = root.querySelector(".combat-tracker-header") ?? root.querySelector("header") ?? root;
      bar.append(btn);
    }
  });
}

export function registerTrackerSettings() {
  game.settings.register(F, "simultaneousTens", {
    name: "Simultaneous actions (same tens)",
    hint: "Optional rule (p. 436): combatants with initiative in the same tens (e.g. 40–49) act simultaneously — the tracker marks them.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => ui.combat?.render()
  });
}
