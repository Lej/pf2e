import { ActorPF2e } from "@actor";
import { DeferredValueParams, MODIFIER_TYPES, ModifierPF2e, ModifierType } from "@actor/modifiers.ts";
import { AbilityString } from "@actor/types.ts";
import { ABILITY_ABBREVIATIONS } from "@actor/values.ts";
import { ItemPF2e } from "@item";
import { DamageCategoryUnique } from "@system/damage/types.ts";
import { DAMAGE_CATEGORIES_UNIQUE } from "@system/damage/values.ts";
import { objectHasKey, sluggify } from "@util";
import type {
    ArrayField,
    BooleanField,
    ModelPropsFromSchema,
    NumberField,
    StringField,
} from "types/foundry/common/data/fields.d.ts";
import { RuleElementOptions, RuleElementPF2e, RuleElementSchema, RuleElementSource } from "./index.ts";

const { fields } = foundry.data;

/**
 * Apply a constant modifier (or penalty/bonus) to a statistic or usage thereof
 * @category RuleElement
 */
class FlatModifierRuleElement extends RuleElementPF2e<FlatModifierSchema> {
    constructor(source: FlatModifierSource, item: ItemPF2e<ActorPF2e>, options?: RuleElementOptions) {
        if (!item.isOfType("physical") && source.type !== "item") {
            source.fromEquipment = false;
        }

        super(source, item, options);

        if (this.type === "ability") {
            if (this.ability) {
                this.slug = this.ability;
                this.label = CONFIG.PF2E.abilities[this.ability];
                // As a resolvable since ability modifiers aren't yet set for PCs
                this.data.value = `@actor.abilities.${this.ability}.mod`;
            } else {
                this.failValidation(
                    'A flat modifier of type "ability" must also have an "ability" property with an ability abbreviation'
                );
            }
        }

        this.critical =
            typeof source.critical === "boolean" && this.selectors.some((s) => s.includes("damage"))
                ? source.critical
                : null;

        if (this.force && this.type === "untyped") {
            this.failValidation("A forced bonus or penalty must have a type");
        }
    }

    static override defineSchema(): FlatModifierSchema {
        return {
            ...super.defineSchema(),
            selector: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, initial: undefined })
            ),
            type: new fields.StringField({
                required: true,
                choices: Array.from(MODIFIER_TYPES),
                initial: "untyped",
            }),
            ability: new fields.StringField({
                required: false,
                choices: Array.from(ABILITY_ABBREVIATIONS),
                initial: undefined,
            }),
            min: new fields.NumberField({ required: false, nullable: false, initial: undefined }),
            max: new fields.NumberField({ required: false, nullable: false, initial: undefined }),
            force: new fields.BooleanField(),
            hideIfDisabled: new fields.BooleanField(),
            fromEquipment: new fields.BooleanField({ initial: true }),
            damageType: new fields.StringField({ required: false, nullable: true, blank: false, initial: undefined }),
            damageCategory: new fields.StringField({
                required: false,
                blank: false,
                choices: Array.from(DAMAGE_CATEGORIES_UNIQUE),
                initial: undefined,
            }),
            critical: new fields.BooleanField({ required: false, nullable: true, initial: undefined }),
        };
    }

    get selectors(): string[] {
        return this.selector;
    }

    override beforePrepareData(): void {
        if (this.ignored) return;

        // Strip out the title ("Effect:", etc.) of the effect name
        const label = this.label.includes(":") ? this.label.replace(/^[^:]+:\s*|\s*\([^)]+\)$/g, "") : this.label;
        const slug = this.slug ?? sluggify(label);

        const selectors = this.selectors.map((s) => this.resolveInjectedProperties(s)).filter((s) => !!s);
        if (selectors.length === 0) {
            return this.failValidation("must have at least one selector");
        }

        if (!this.data.value) {
            return this.failValidation("must have a value");
        }

        for (const selector of selectors) {
            const construct = (options: DeferredValueParams = {}): ModifierPF2e | null => {
                const resolvedValue = Number(this.resolveValue(this.data.value, 0, options)) || 0;
                if (this.ignored) return null;

                const finalValue = Math.clamped(resolvedValue, this.min ?? resolvedValue, this.max ?? resolvedValue);

                if (game.pf2e.variantRules.AutomaticBonusProgression.suppressRuleElement(this, finalValue)) {
                    return null;
                }

                // Allow a `damageType` resolved to an empty string be treated as `null`
                const damageType = this.damageType ? this.resolveInjectedProperties(this.damageType) || null : null;
                if (damageType !== null && !objectHasKey(CONFIG.PF2E.damageTypes, damageType)) {
                    this.failValidation(`Unrecognized damage type: ${damageType}`);
                    return null;
                }

                const modifier = new ModifierPF2e({
                    slug,
                    label,
                    modifier: finalValue,
                    type: this.type,
                    ability: this.type === "ability" ? this.ability : null,
                    predicate: this.resolveInjectedProperties(this.predicate),
                    force: this.force,
                    damageType,
                    damageCategory: this.damageCategory,
                    critical: this.critical,
                    hideIfDisabled: this.hideIfDisabled,
                    source: this.item.uuid,
                });
                if (options.test) modifier.test(options.test);

                return modifier;
            };

            const modifiers = (this.actor.synthetics.statisticsModifiers[selector] ??= []);
            modifiers.push(construct);
        }
    }
}

interface FlatModifierRuleElement
    extends RuleElementPF2e<FlatModifierSchema>,
        ModelPropsFromSchema<FlatModifierSchema> {}

type FlatModifierSchema = RuleElementSchema & {
    /** All domains to add a modifier to */
    selector: ArrayField<StringField<string, string, true, false, false>>;
    /** The modifier (or bonus/penalty) type */
    type: StringField<ModifierType, ModifierType, true, false, true>;
    /** If this is an ability modifier, the ability score it modifies */
    ability: StringField<AbilityString, AbilityString, false, false, false>;
    /** Hide this modifier from breakdown tooltips if it is disabled */
    min: NumberField<number, number, false, false, false>;
    max: NumberField<number, number, false, false, false>;
    hideIfDisabled: BooleanField;
    /** Whether to use this bonus/penalty/modifier even if it isn't the greatest magnitude */
    force: BooleanField;
    /** Whether this modifier comes from equipment or an equipment effect */
    fromEquipment: BooleanField;
    /** If a damage modifier, a damage type */
    damageType: StringField<string, string, false, true, false>;
    /** If a damage modifier, a special category */
    damageCategory: StringField<DamageCategoryUnique, DamageCategoryUnique, false, false, false>;
    /** If a damage modifier, whether it applies given the presence or absence of a critically successful attack roll */
    critical: BooleanField<boolean, boolean, false, true, false>;
};

interface FlatModifierSource extends RuleElementSource {
    selector?: unknown;
    min?: unknown;
    max?: unknown;
    type?: unknown;
    ability?: unknown;
    force?: unknown;
    damageType?: unknown;
    damageCategory?: unknown;
    critical?: unknown;
    hideIfDisabled?: unknown;
    fromEquipment?: unknown;
}

export { FlatModifierRuleElement, FlatModifierSource };
