/**
 * Pomocnik formuły obrażeń w karcie przedmiotu: przyciski-klocki (kości, działania, atrybuty, umiejętność/10, poziom,
 * floor/ceil/min/max) dopisują element w miejscu kursora, a podgląd na żywo pokazuje formułę dla właściciela
 * (albo przykładowej postaci) z minimum, średnią i maksimum — albo błąd, zanim formuła trafi do walki.
 */
import { SKILLS, ATTRS } from "./data.mjs";
import { damageFormula } from "./combat.mjs";
import { resolveFormula, formulaVals, unknownTokens } from "./formula-data.mjs";
import { heldByTK, tkOf } from "./tk.mjs";
import { t, isPL } from "./i18n.mjs";

const ATTR_BTN = [["STR", "str"], ["PER", "per"], ["END", "end"], ["CHA", "cha"], ["INT", "int"], ["AGI", "agi"], ["LUCK", "luck"]];
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const num = n => (isPL() ? String(n).replace(".", ",") : String(n));

/** Przykładowa postać bez właściciela: atrybuty 5, rangi 50, poziom 1. */
const SAMPLE = {
  attrs: Object.fromEntries(Object.keys(ATTRS).map(k => [k, 5])),
  skills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, 50])),
  level: 1
};

/** Formuła po podstawieniu dla przedmiotu i jego właściciela (jak przy rzucie). */
function previewFormula(item, raw) {
  const actor = item.parent?.documentName === "Actor" ? item.parent : null;
  const vals = actor ? formulaVals(actor.system) : SAMPLE;
  if (item.type === "weapon") {
    const w = { ...item.system, damage: raw };
    const tk = actor && heldByTK(actor, item) ? tkOf(actor) : null;
    const df = damageFormula(w, { str: vals.attrs.str ?? 0, rank: vals.skills[w.skill] ?? 0, vals, tk: tk ? { int: tk.int, mult: tk.mighty > 0 } : null });
    return { actor, formula: df.formula, notes: df.notes };
  }
  const r = resolveFormula(raw, vals);
  return { actor, formula: r.formula, notes: r.used };
}

/** Minimum, średnia (dla kości: (min+max)/2) i maksimum; null — formuła błędna. */
function range(formula) {
  try {
    if (!Roll.validate(formula)) return null;
    const lo = new Roll(formula).evaluateSync({ minimize: true }).total;
    const hi = new Roll(formula).evaluateSync({ maximize: true }).total;
    return { lo, hi, avg: Math.round(((lo + hi) / 2) * 10) / 10 };
  } catch { return null; }
}

function chipsHtml() {
  const dice = [4, 6, 8, 10, 12, 20].map(d => `<button type="button" data-ins="1d${d}" title="${t("dice: change the 1 to the number of dice")}">k${d}</button>`).join("");
  const ops = [["+", "+"], ["−", "-"], ["×", "*"], ["÷", "/"], ["( )", "()"]].map(([l, v]) => `<button type="button" data-ins="${v}">${l}</button>`).join("");
  const attrs = ATTR_BTN.map(([tok, k]) => `<button type="button" data-ins="${tok}" title="${esc(ATTRS[k])}${k === "str" ? ` — ${t("in melee weapons multiplied by the Melee/Unarmed rank")}` : ""}">${tok}</button>`).join("");
  const skills = `<select data-ins-skill title="${t("Skill rank / 10 (rounded down)")}"><option value="">${t("skill / 10…")}</option>${Object.entries(SKILLS).map(([k, s]) => `<option value="${k.toUpperCase()}10">${esc(s.label)}</option>`).join("")}</select>`;
  const fns = [["floor", t("round down")], ["ceil", t("round up")], ["min", t("smaller of two")], ["max", t("larger of two")]]
    .map(([f, tip]) => `<button type="button" data-fn="${f}" title="${tip}${f === "floor" || f === "ceil" ? ` — ${t("wraps the selected part")}` : ""}">${f}</button>`).join("");
  return `<div class="fh-chips">${dice}<span class="fh-sep"></span>${ops}<span class="fh-sep"></span>${attrs}<button type="button" data-ins="LVL" title="${t("Character level")}">LVL</button>${skills}<span class="fh-sep"></span>${fns}</div><div class="fh-preview"></div>`;
}

/** Dopisz tekst w miejscu kursora (albo obejmij zaznaczenie funkcją) i zapisz pole. */
function insert(input, text, fn = null) {
  const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? input.value.length;
  const sel = input.value.slice(s, e);
  let add, caret;
  if (fn) {
    const inner = sel || (fn === "min" || fn === "max" ? ", " : "");
    add = `${fn}(${inner})`;
    caret = s + fn.length + 1 + (sel ? inner.length + 1 : 0);
  } else {
    const before = input.value.slice(0, s);
    const pad = before && !/[\s(]$/.test(before) && !/^[)\s]/.test(text) ? " " : "";
    // wartość (kość, atrybut, poziom, umiejętność) zaraz po innej wartości — dopisz „+”, żeby formuła była poprawna
    const term = !/^[+\-*/()]+$/.test(text);
    const plus = term && /[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_)]\s*$/.test(before) ? "+ " : "";   // pl-ok
    add = text === "()" ? `(${sel})` : `${pad}${plus}${text}${/^[+\-*/]$/.test(text) ? " " : ""}`;
    caret = s + add.length - (text === "()" && !sel ? 1 : 0);
  }
  input.value = input.value.slice(0, s) + add + input.value.slice(e);
  input.focus();
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Podłącz pomocnika do wszystkich pól formuły w karcie przedmiotu (wywoływane po każdym renderze). */
export function attachFormulaHelp(root, item) {
  for (const box of root.querySelectorAll(".formula-help")) {
    const input = box.previousElementSibling?.querySelector?.('input[name="system.damage"]');
    if (!input || box.dataset.ready) continue;
    box.dataset.ready = "1";
    box.innerHTML = chipsHtml();
    const out = box.querySelector(".fh-preview");
    const show = () => {
      const raw = input.value.trim();
      if (!raw) { out.innerHTML = `<span class="fh-hint">${t("Empty — no damage.")}</span>`; return; }
      const p = previewFormula(item, raw);
      const unknown = unknownTokens(p.formula).filter(w => !/^(D|K)$/.test(w));
      const r = unknown.length ? null : range(p.formula);
      const who = p.actor ? esc(p.actor.name) : t("a sample character (attributes 5, ranks 50)");
      if (!r) {
        out.innerHTML = `<span class="fh-bad"><i class="fa-solid fa-triangle-exclamation"></i> ${unknown.length ? t("Unknown words: {list}", { list: esc(unknown.join(", ")) }) : t("Invalid formula — check brackets and signs.")}</span>`;
        return;
      }
      out.innerHTML = `${t("For {who}:", { who })} <b>${esc(p.formula)}</b> → ${t("min {lo} · avg {avg} · max {hi}", { lo: num(r.lo), avg: num(r.avg), hi: num(r.hi) })}`
        + (p.notes?.length ? ` <small>(${esc(p.notes.join("; "))})</small>` : "");
    };
    // klocki nie zabierają kursora z pola (inaczej każde kliknięcie zapisywałoby i odświeżało kartę)
    box.addEventListener("mousedown", ev => { if (ev.target.closest("button")) ev.preventDefault(); });
    box.addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      ev.preventDefault();
      insert(input, b.dataset.ins ?? "", b.dataset.fn ?? null);
    });
    box.querySelector("[data-ins-skill]")?.addEventListener("change", ev => {
      const v = ev.target.value;
      ev.target.value = "";
      if (v) insert(input, v);
    });
    // podgląd na żywo; zapis dopiero po wyjściu z pola poza pomocnika (zmiany ze skryptu nie wywołują „change”)
    let dirty = false;
    input.addEventListener("input", () => { dirty = true; show(); });
    input.addEventListener("change", () => { dirty = false; });
    input.addEventListener("blur", ev => {
      if (!dirty || box.contains(ev.relatedTarget)) return;
      dirty = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    box.querySelector("[data-ins-skill]")?.addEventListener("blur", ev => {
      if (!dirty || ev.relatedTarget === input || box.contains(ev.relatedTarget)) return;
      dirty = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    show();
  }
}
