import { baseSpellEffect, generateMacroChange, generateMacroFlags, spellEffectModules } from "../specialSpells.js";

export function enlargeReduceEffect(document) {
  if (!spellEffectModules().atlInstalled) return document;

  let effect = baseSpellEffect(document, document.name);
  // MACRO START
  const itemMacroText = `
if (!game.modules.get("advanced-macros")?.active) {
  ui.notifications.error("Please enable the Advanced Macros module");
  return;
}
if (!game.modules.get("ATL")?.active) {
  ui.notifications.error("Please enable the Advanced Token Effects module");
  return;
}
const lastArg = args[args.length - 1];
const tokenOrActor = await fromUuid(lastArg.actorUuid);
const targetActor = tokenOrActor.actor ? tokenOrActor.actor : tokenOrActor;
const tokenFromUuid = await fromUuid(lastArg.tokenUuid);
const targetToken = tokenFromUuid.data || token;

async function reSize(flavour) {
  const originalSize = parseInt(targetToken.width);
  const types = {
    enlarge: {
      size: originalSize + 1,
      bonus: "+1d4",
    },
    reduce: {
      size: originalSize > 1 ? originalSize - 1 : originalSize - 0.3,
      bonus: "-1d4",
    },
  };
  const changes = [
    {
      key: "data.bonuses.mwak.damage",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      priority: 20,
      value: \`\${types[flavour].bonus}\`,
    },
    {
      key: "ATL.width",
      mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
      priority: 30,
      value: \`\${types[flavour].size}\`,
    },
    {
      key: "ATL.height",
      mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
      priority: 30,
      value: \`\${types[flavour].size}\`,
    },
  ];
  const effect = targetActor.effects.find((e) => e.data.label === lastArg.efData.label);
  await effect.update({ changes: changes.concat(effect.data.changes) });
  ChatMessage.create({ content: \`\${targetToken.name} is \${flavour}d\` });
}

if (args[0] === "on") {
  new Dialog({
    title: "Enlarge or Reduce",
    buttons: {
      one: {
        label: "Enlarge",
        callback: async () => await reSize("enlarge"),
      },
      two: {
        label: "Reduce",
        callback: async () => await reSize("reduce"),
      },
    },
  }).render(true);
}
`;
  // MACRO STOP
  document.flags["itemacro"] = generateMacroFlags(document, itemMacroText);
  effect.changes.push(generateMacroChange("", 0));
  document.effects.push(effect);

  return document;
}
