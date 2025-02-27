import DICTIONARY from "../../dictionary.js";
import utils from "../../lib/utils.js";
import DDBHelper from "../../lib/DDBHelper.js";
import { generateBaseSkillEffect } from "../../effects/effects.js";
import logger from "../../logger.js";
import DDBCharacter from "../DDBCharacter.js";

DDBCharacter.prototype._isHalfProficiencyRoundedUp = function _isHalfProficiencyRoundedUp (skill, modifiers = null) {
  const longAbility = DICTIONARY.character.abilities
    .filter((ability) => skill.ability === ability.value)
    .map((ability) => ability.long)[0];

  const roundUp = (modifiers)
    ? DDBHelper.filterModifiers(modifiers, "half-proficiency-round-up", `${longAbility}-ability-checks`)
    : DDBHelper.filterBaseModifiers(this.source?.ddb, "half-proficiency-round-up", `${longAbility}-ability-checks`, ["", null], true);
  return Array.isArray(roundUp) && roundUp.length;
};

DDBCharacter.prototype.getSkillProficiency = function getSkillProficiency (skill, modifiers = null) {
  if (!modifiers) {
    modifiers = [
      DDBHelper.getChosenClassModifiers(this.source.ddb, true),
      DDBHelper.getModifiers(this.source.ddb, "race", true),
      DDBHelper.getModifiers(this.source.ddb, "background", true),
      DDBHelper.getModifiers(this.source.ddb, "feat", true),
      DDBHelper.getActiveItemModifiers(this.source.ddb, true),
    ].flat();
  }

  const skillMatches = modifiers
    .filter((modifier) => modifier.friendlySubtypeName === skill.label)
    .map((mod) => mod.type);

  const halfProficiency = modifiers.find(
    (modifier) =>
    // Jack of All trades/half-rounded down
      (modifier.type === "half-proficiency" && modifier.subType === "ability-checks")
        // e.g. champion for specific ability checks
        || this._isHalfProficiencyRoundedUp(skill, modifiers)
  ) !== undefined
    ? 0.5
    : 0;

  const proficient = skillMatches.includes("expertise") ? 2 : skillMatches.includes("proficiency") ? 1 : halfProficiency;

  return proficient;
};

DDBCharacter.prototype.getCustomSkillProficiency = function getCustomSkillProficiency(skill) {
  // Overwrite the proficient value with any custom set over rides
  if (this.source.ddb.character.characterValues) {
    const customProficiency = this.source.ddb.character.characterValues.find(
      (value) => value.typeId === 26 && value.valueId == skill.valueId && value.value
    );
    if (customProficiency) {
      return DICTIONARY.character.customSkillProficiencies.find((prof) => prof.value === customProficiency.value)
        .proficient;
    }
  }
  return undefined;
};

DDBCharacter.prototype.getCustomSkillAbility = function getCustomSkillAbility(skill) {
  // Overwrite the proficient value with any custom set over rides
  let mod;
  if (this.source.ddb.character.characterValues) {
    const customAbility = this.source.ddb.character.characterValues.find(
      (value) => value.typeId === 27 && value.valueId == skill.valueId
    );
    if (customAbility) {
      const ability = DICTIONARY.character.abilities.find((ability) => ability.id == customAbility.value);
      if (ability)
        mod = ability.value;
    }
  }
  return mod;
};

DDBCharacter.prototype.getCustomSkillBonus = function getCustomSkillBonus(skill) {
  // Get any custom skill bonuses
  if (this.source.ddb.character.characterValues) {
    const customBonus = this.source.ddb.character.characterValues.filter(
      (value) => (value.typeId == 24 || value.typeId == 25) && value.valueId == skill.valueId
    ).reduce((total, bonus) => {
      return total + bonus.value;
    }, 0);

    if (customBonus) {
      return customBonus;
    }
  }
  return 0;
};

DDBCharacter.prototype._setSpecialSkills = function _setSpecialSkills() {
  this.source.ddb.character.classes.forEach((klass) => {
    if (klass.subclassDefinition) {
      const silverTongue = klass.subclassDefinition.classFeatures.some(
        (feature) => feature.name === "Silver Tongue" && klass.level >= feature.requiredLevel
      );
      if (silverTongue) {
        this.raw.character.system.skills["per"].bonuses.minimum = 10;
        this.raw.character.system.skills["dec"].bonuses.minimum = 10;
      }
    }
  });
};

DDBCharacter.prototype._generateCustomSkills = async function _generateCustomSkills() {
  if (!game.modules.get("dnd5e-custom-skills")?.active) return;
  const version = game.modules.get("dnd5e-custom-skills")?.version;
  const newEnough = foundry.utils.isNewerVersion(version, "1.1.2");
  if (!newEnough) return;

  const customSkillData = this.source.ddb.character.customProficiencies
    .filter((prof) => prof.type === 1 && Number.isInteger(prof.statId))
    .map((prof) => {
      const ability = DICTIONARY.character.abilities.find((ability) => ability.id == prof.statId);
      return {
        ability: ability.value,
        label: prof.name,
        proficiencyLevel: prof.proficiencyLevel,
        miscBonus: prof.miscBonus,
        magicBonus: prof.magicBonus,
        override: prof.override,
      };
    });

  const skillData = {};

  for (let i = 0; i < customSkillData.length; i++) {
    skillData[i] = customSkillData[i];
  }

  const customSkills = await window.dnd5eCustomSkills("add", { skills: skillData });

  for (const [key, value] of Object.entries(customSkills.skills.list)) {
    if (value.applied || value.applied === 1) {
      const customSkillMatch = customSkillData.find((customSkill) => customSkill.label === value.label);
      if (customSkillMatch) {
        logger.debug(`Adding custom skill ${value.label}`, { key, value, customSkillMatch });
        const prof = DICTIONARY.character.customSkillProficiencies.find((proficiency) =>
          proficiency.value === customSkillMatch.proficiencyLevel
        ).proficient;
        const miscBonus = customSkillMatch.miscBonus && customSkillMatch.miscBonus !== "" && customSkillMatch.miscBonus !== 0
          ? `+ ${customSkillMatch.miscBonus}`
          : "";
        const magicBonus = customSkillMatch.magicBonus && customSkillMatch.magicBonus !== "" && customSkillMatch.magicBonus !== 0
          ? ` + ${customSkillMatch.magicBonus}`
          : "";
        if (customSkillMatch) {
          this.raw.character.system.skills[key] = {
            type: "Number",
            label: value.label,
            ability: value.ability,
            value: prof,
            mod: utils.calculateModifier(value),
            bonus: 0,
            bonuses: {
              "check": `${(miscBonus + magicBonus).trim()}`,
              "passive": "",
              "minimum": null,
            },
          };
        }
      }
    }
  }
};

DDBCharacter.prototype._generateSkills = async function _generateSkills() {
  const addEffects = game.modules.get("dae")?.active;

  if (!addEffects) this.raw.character.flags['skill-customization-5e'] = {};
  DICTIONARY.character.skills.forEach((skill) => {
    const customProficient = this.getCustomSkillProficiency(skill);
    // we use !== undefined because the return value could be 0, which is falsey
    const proficient = customProficient !== undefined ? customProficient : this.getSkillProficiency(skill);

    // some abilities round half prof up, some down
    const proficiencyBonus = this._isHalfProficiencyRoundedUp(skill)
      ? Math.ceil(2 * this.raw.character.system.attributes.prof * proficient)
      : Math.floor(2 * this.raw.character.system.attributes.prof * proficient);

    // Skill bonuses
    const skillModifierBonus = DDBHelper
      .filterBaseModifiers(this.source.ddb, "bonus", skill.subType)
      .map((skl) => skl.value)
      .reduce((a, b) => a + b, 0) ?? 0;
    const customSkillBonus = this.getCustomSkillBonus(skill);
    const skillBonus = skillModifierBonus + customSkillBonus;
    const value = this.raw.character.system.abilities[skill.ability].value + proficiencyBonus + skillBonus;
    const customAbility = this.getCustomSkillAbility(skill);
    const ability = customAbility !== undefined ? customAbility : skill.ability;

    // custom skill ability over ride effects
    if (customAbility) {
      const label = "Skill Ability Changes";
      const change = {
        key: `data.skills.${skill.name}.ability`,
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
        value: `${customAbility}`,
        priority: "20"
      };

      const changeIndex = this.raw.character.effects.findIndex((effect) => effect.label === label);
      if (changeIndex >= 0) {
        this.raw.character.effects[changeIndex].changes.push(change);
      } else {
        let skillEffect = generateBaseSkillEffect(this.source.ddb.character.id, label);
        skillEffect.changes.push(change);
        this.raw.character.effects.push(skillEffect);
      }
    }

    this.raw.character.system.skills[skill.name] = {
      type: "Number",
      label: skill.label,
      ability: ability,
      value: proficient,
      mod: utils.calculateModifier(value),
      bonus: 0,
      bonuses: {
        check: `${skillBonus}`,
        passive: "",
        minimum: null,
      },
    };
  });

  await this._generateCustomSkills();
  this._setSpecialSkills();

};
