/**
 * Ograniczenia wad i cech z podręcznika (s. 74–124): kto może je wziąć, z czym się wykluczają, czego wymagają.
 * Klucze: "h:<wada>", "t:<cecha>", "org:<organizacja>" (wybór w cesze Organization), "race:<rasa>".
 *   races / notRaces — rasy (klucze RACES), magic / flight — wymagana umiejętność rasowa,
 *   notWith — wykluczenia (działają w obie strony), needsAny — wymaga jednego z (błąd przy tworzeniu),
 *   attrMin / attrMax — atrybut przy tworzeniu (błąd, bo atrybuty są w kolejnym kroku),
 *   gm — tylko ostrzeżenie: zgoda MG.
 * GRANTS — co wada lub cecha daje za darmo (Slave → Internal/Concealed Storage, s. 92).
 */
import { t, N_ } from "./i18n.mjs";

const ALI = ["alicornUnity", "alicornPost", "alicornGen2"];
const PEG = ["pegGround", "pegDash", "pegEnclave"];
const PONY = ["earth", "unicorn", ...PEG, "bat"];          // kucyki (bez alikornów — mają własne zasady)
const GHOULS = ["t:ghoul", "t:canterlotGhoul"];

export const LIMITS = {
  // ---------- wady ----------
  "h:addictive": { notWith: GHOULS },
  "h:amnesiac": { notWith: ["h:guiltyConscience", "h:unforgivable"] },
  "h:badLuck": { notWith: ["t:lucky"] },
  "h:badLuckCharm": { notWith: ["t:goodLuckCharm"] },
  "h:bigEars": { notWith: ["h:deaf", "h:hardOfHearing"] },
  "h:blind": { notWith: ["h:wallEyed", "h:fourEyes", "h:colorBlind"] },
  "h:cannibal": { notRaces: ALI, notWith: GHOULS },
  "h:cautious": { notWith: ["h:curious", "h:ponikaze", "h:impatient"] },
  "h:codeOfHonor": { notWith: ["h:sadist"] },
  "h:cowardly": { notWith: ["t:brave", "h:hotBlooded"] },
  "h:elderly": { notRaces: ALI, notWith: ["h:young", "t:contortionist"] },
  "h:faithless": { races: [...PONY, ...ALI], notWith: ["t:faith"] },
  "h:flightless": { flight: true, notWith: ["h:stubby"] },
  "h:flightSchoolDropout": { flight: true, notWith: ["t:aceFlyer"] },
  "h:fourEyes": { attrMin: { per: 2 }, attrMax: { per: 9 }, notWith: ["h:wallEyed"] },
  "h:goodNatured": { notWith: ["h:sadist"] },
  "h:guiltyConscience": { notWith: ["h:halfHeart", "t:clearConscience", "h:prideful", "h:suicidal"] },
  "h:halfHeart": { notRaces: ALI, notWith: ["t:clearConscience", "h:amnesiac", "h:suicidal", "h:optimistic", "h:cowardly", "t:faith"] },
  "h:illiterate": { notWith: ["t:astronomer", "t:ministryEmployee", "t:formalEducation", "t:stableDweller", "t:powerArmor", "t:specialization",
    "h:studious", "t:medicineMare", "t:arcaneDevotion", "org:knight", "org:scribe", "org:ajKnight", "org:ajScribe", "org:evc", "org:legion"] },
  "h:impreciseMagic": { races: ["unicorn", ...ALI], notWith: ["t:magicalSavant", "t:arcaneDevotion"] },
  "h:jinxed": { notWith: ["t:lucky", "t:goodLuckCharm"] },
  "h:maimed": { notRaces: ALI, notWith: ["t:canterlotGhoul", "t:cyberpony"] },
  "h:mutation": { notRaces: ALI, notWith: [...GHOULS] },
  "h:mute": { notRaces: ALI },
  "h:naive": { needsAny: ["t:stableDweller", "org:evc"] },
  "h:obese": { notRaces: ALI, notWith: [...GHOULS, "h:skinny", "h:pipsqueak", "t:contortionist"] },
  "h:oneTrickPony": { magic: true, notWith: ["t:magicalSavant", "h:stubby", "t:arcaneDevotion"] },
  "h:overactive": { attrMin: { int: 5 } },
  "h:picky": { notWith: ["t:omnivore", "t:tastesFine", "h:scavenger"] },
  "h:pipsqueak": { notWith: ["t:large"] },
  "h:prejudiced": { notWith: ["t:openMinded", "t:medicineMare"] },
  "h:sadist": { notWith: ["org:crusaders"] },
  "h:scarred": { notRaces: ALI, notWith: GHOULS },
  "h:shadowOfTheMoon": { gm: { races: [...ALI, "zebra"], why: N_("only alicorns, half-alicorns and zebra shamans") } },
  "h:sickly": { notRaces: ALI, notWith: [...GHOULS, "t:zebraAugmented"] },
  "h:skinny": { notRaces: ALI },
  "h:securityMare": { gm: { why: N_("requires the Live by Luck rules") } },
  "h:sprayAndPray": { notWith: ["h:triggerDiscipline"] },
  "h:stubby": { races: ["unicorn", ...PEG], notWith: ["t:magicalSavant", "t:arcaneDevotion"] },
  "h:studious": {},
  "h:suicidal": { notWith: ["t:clearConscience"] },
  "h:thorough": { notWith: ["t:quickWitted"] },
  "h:uncontrolledMagic": { magic: true },
  "h:unforgivable": { notWith: ["t:stableDweller"] },
  "h:unstableGenetics": { notRaces: ALI, notWith: GHOULS },
  "h:young": { notRaces: ALI, notWith: ["t:large", "t:foalAtHeart", "t:shadowflash"] },
  "h:abandoned": { notWith: ["t:formalEducation", "t:organization", "t:stableDweller"] },
  "h:addiction": { notWith: ["t:dareingDo"] },
  // ---------- cechy ----------
  "t:aceFlyer": { flight: true },
  "t:additionalSpell": { magic: true, notRaces: ALI },
  "t:animalCompanion": { notWith: ["t:robotCompanion"] },
  "t:arcaneDevotion": { magic: true, needsTag: "magic", attrMinOr: { attr: "int", min: 8, or: "h:studious" } },
  "t:astronomer": { races: ["zebra"] },
  "t:channeler": { magic: true },
  "t:contortionist": { attrMin: { agi: 6 } },
  "t:cyberpony": { notWith: ["t:zebraAugmented", "t:canterlotGhoul"] },
  "t:dareingDo": { notWith: ["h:addictive"] },
  "t:heavenlyVision": { notRaces: ["hellhound"], notWith: GHOULS },
  "t:implanted": { notRaces: ALI, notWith: ["t:canterlotGhoul", "t:zebraAugmented"] },
  "t:ironStomach": { notWith: GHOULS },
  "t:magicalSavant": { magic: true, attrMin: { int: 8 } },
  "t:ministryDescendant": { races: PONY },
  "t:ministryEmployee": { needsAny: [...ALI.map(r => `race:${r}`), "t:cyberpony", ...GHOULS] },
  "t:omnivore": { notWith: GHOULS },
  "t:organization": { notWith: ["t:stableDweller"] },
  "t:powerArmor": { gm: { races: ["pegDash"], orAny: ["org:knight", "org:ajKnight", "org:evc", "org:mercenary"], why: N_("only Dashites, Steel Rangers, Applejack's Rangers, EVC and griffin mercenaries") } },
  "t:stableDweller": { notRaces: [...ALI, "sanddog", "hellhound", "pegEnclave", "pegDash"], notWith: ["t:cache"] },
  "t:medicineMare": { notRaces: ["zebra", "pegEnclave", "pegDash"], notWith: ["org:knight", "org:scribe", "org:ajKnight", "org:ajScribe", "org:reaper2", "org:reaper3"],
    gm: { why: N_("requires GM permission") } },
  "t:zebraAugmented": { races: ["zebra"], notWith: GHOULS },
  "t:ghoul": { notRaces: ALI, notWith: ["h:addictive", "h:unstableGenetics", "h:mutation", "t:canterlotGhoul", "t:zebraAugmented"] },
  "t:canterlotGhoul": { races: [...PONY, "zebra", "griffin"], notWith: ["h:addictive", "h:unstableGenetics", "h:mutation"] },
  "t:shadowflash": { races: ["bat"] },
  // ---------- organizacje (opcje cechy Organization, s. 112–116) ----------
  "org:legion": { races: ["zebra", "minotaur"] },
  "org:proditor": { races: ["zebra"] },
  "org:evc": { races: PEG },
  "org:raider": { needsAny: ["h:sadist"] },
  "org:crusaders": { needsAny: ["h:young", "t:foalAtHeart"] }
};

/** Co wady i cechy dają za darmo. */
export const GRANTS = {
  "h:slave": [{ key: "concealedStorage", free: true }]
};

// wykluczenia w obie strony
const NOT = new Map();
for (const [k, v] of Object.entries(LIMITS)) for (const o of v.notWith ?? []) {
  if (!NOT.has(k)) NOT.set(k, new Set());
  if (!NOT.has(o)) NOT.set(o, new Set());
  NOT.get(k).add(o); NOT.get(o).add(k);
}

/**
 * Ocena jednej wady/cechy/organizacji w danym stanie kreatora.
 * ctx: { raceKey, race (RACES[raceKey]), has(ref) → bool, label(ref) → nazwa, raceLabel(key), attrs?: {k: total}, tags?: [] }
 * Wynik: { block: [] (nie da się wziąć — rasa, wykluczenie, brak umiejętności rasowej), need: [] (błąd, dopóki
 * nie spełnisz wymagania), gm: [] (ostrzeżenie: zgoda MG) }.
 */
export function evalLimit(ref, ctx) {
  const L = LIMITS[ref] ?? {};
  const out = { block: [], need: [], gm: [] };
  const manual = !!ctx.race?.manual;
  if (!manual && L.races && !L.races.includes(ctx.raceKey))
    out.block.push(t("only: {races}", { races: L.races.map(ctx.raceLabel).join(", ") }));
  if (!manual && L.notRaces?.includes(ctx.raceKey)) out.block.push(t("not for: {race}", { race: ctx.raceLabel(ctx.raceKey) }));
  if (!manual && L.magic && !ctx.race?.racial?.magic) out.block.push(t("requires the Magic racial skill"));
  if (!manual && L.flight && !ctx.race?.racial?.flight) out.block.push(t("requires the Flight racial skill"));
  const clash = [...(NOT.get(ref) ?? [])].filter(o => ctx.has(o));
  if (clash.length) out.block.push(t("doesn't combine with: {list}", { list: clash.map(ctx.label).join(", ") }));
  if (L.needsAny && !L.needsAny.some(o => ctx.has(o))) out.need.push(t("requires: {list}", { list: L.needsAny.map(ctx.label).join(` ${t("conj|or")} `) }));
  if (L.needsTag && ctx.tags && !ctx.tags.includes(L.needsTag)) out.need.push(t("requires {skill} as a tagged skill (Skills step)", { skill: ctx.skillLabel(L.needsTag) }));
  if (ctx.attrs) {
    for (const [a, n] of Object.entries(L.attrMin ?? {})) if ((ctx.attrs[a] ?? 0) < n) out.need.push(t("requires {attr} {n} or more (S.P.E.C.I.A.L. step)", { attr: a.toUpperCase(), n }));
    for (const [a, n] of Object.entries(L.attrMax ?? {})) if ((ctx.attrs[a] ?? 0) > n) out.need.push(t("requires {attr} {n} or less (S.P.E.C.I.A.L. step)", { attr: a.toUpperCase(), n }));
    const o = L.attrMinOr;
    if (o && (ctx.attrs[o.attr] ?? 0) < o.min && !ctx.has(o.or)) out.need.push(t("requires {attr} {n} or {name}", { attr: o.attr.toUpperCase(), n: o.min, name: ctx.label(o.or) }));
  }
  if (L.gm) {
    const ok = (L.gm.races && L.gm.races.includes(ctx.raceKey)) || (L.gm.orAny ?? []).some(o => ctx.has(o));
    if (!ok) out.gm.push(t("with GM approval — {why}", { why: t(L.gm.why) }));
  }
  return out;
}
