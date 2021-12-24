import type { ItemPF2e } from "@item";
import { RuleElementPF2e } from "./rule-element";
export { RuleElementPF2e };
import { RuleElementSource } from "./rules-data-definitions";
import { FlatModifierRuleElement } from "./elements/flat-modifier";
import { FixedProficiencyRuleElement } from "./elements/fixed-proficiency";
import { TempHPRuleElement } from "./elements/temp-hp";
import { DexterityModifierCapRuleElement } from "./elements/dexterity-modifier-cap";
import { DamageDiceRuleElement } from "./elements/damage-dice";
import { TogglePropertyRuleElement } from "./elements/toggle-property";
import { TokenImageRuleElement } from "./elements/token-image";
import { BaseSpeedRuleElement } from "./elements/base-speed";
import { SenseRuleElement } from "./elements/sense";
import { TokenEffectIconRuleElement } from "./elements/token-effect-icon";
import { StrikeRuleElement } from "./elements/strike";
import { RollNoteRuleElement } from "./elements/roll-note";
import { WeaponPotencyRuleElement } from "./elements/weapon-potency";
import { StrikingRuleElement } from "./elements/striking";
import { MultipleAttackPenaltyRuleElement } from "./elements/multiple-attack-penalty";
import { ActorTraitsRuleElement } from "@module/rules/elements/actor-traits";
import { RecoveryCheckDCRuleElement } from "@module/rules/feats/recovery-check-dc";
import { AdjustDegreeOfSuccessRuleElement } from "./elements/adjust-degree-of-success";
import { AELikeRuleElement } from "./elements/ae-like";
import { LoseHitPointsRuleElement } from "./elements/lose-hit-points";
import { CreatureSizeRuleElement } from "./elements/creature-size";
import { BattleFormRuleElement } from "./elements/battle-form/rule-element";
import { ImmunityRuleElement } from "./elements/iwr/immunity";
import { WeaknessRuleElement } from "./elements/iwr/weakness";
import { ResistanceRuleElement } from "./elements/iwr/resistance";
import { RollOptionRuleElement } from "./elements/roll-option";
import { EffectTargetRuleElement } from "./elements/effect-target/rule-element";
import { CraftingFormulaRuleElement } from "@module/rules/elements/crafting/crafting-formula";
import { CraftingEntryRuleElement } from "./elements/crafting/crafting-entry";
import { ChoiceSetRuleElement } from "./elements/choice-set/rule-element";
import { MartialProficiencyRuleElement } from "./elements/martial-proficiency";
import { GrantItemRuleElement } from "./elements/grant-item";

/**
 * @category RuleElement
 */
export class RuleElements {
    static readonly builtin: Record<string, RuleElementConstructor | undefined> = Object.freeze({
        ActiveEffectLike: AELikeRuleElement,
        ActorTraits: ActorTraitsRuleElement,
        AdjustDegreeOfSuccess: AdjustDegreeOfSuccessRuleElement,
        BaseSpeed: BaseSpeedRuleElement,
        BattleForm: BattleFormRuleElement,
        ChoiceSet: ChoiceSetRuleElement,
        CraftingEntry: CraftingEntryRuleElement,
        CraftingFormula: CraftingFormulaRuleElement,
        CreatureSize: CreatureSizeRuleElement,
        DamageDice: DamageDiceRuleElement,
        DexterityModifierCap: DexterityModifierCapRuleElement,
        EffectTarget: EffectTargetRuleElement,
        FixedProficiency: FixedProficiencyRuleElement,
        FlatModifier: FlatModifierRuleElement,
        GrantItem: GrantItemRuleElement,
        Immunity: ImmunityRuleElement,
        MartialProficiency: MartialProficiencyRuleElement,
        LoseHitPoints: LoseHitPointsRuleElement,
        MultipleAttackPenalty: MultipleAttackPenaltyRuleElement,
        Note: RollNoteRuleElement,
        RecoveryCheckDC: RecoveryCheckDCRuleElement,
        Resistance: ResistanceRuleElement,
        RollOption: RollOptionRuleElement,
        TempHP: TempHPRuleElement,
        ToggleProperty: TogglePropertyRuleElement,
        TokenEffectIcon: TokenEffectIconRuleElement,
        TokenImage: TokenImageRuleElement,
        Sense: SenseRuleElement,
        Strike: StrikeRuleElement,
        Striking: StrikingRuleElement,
        Weakness: WeaknessRuleElement,
        WeaponPotency: WeaponPotencyRuleElement,
    });

    static custom: Record<string, RuleElementConstructor | undefined> = {};

    static fromOwnedItem(item: Embedded<ItemPF2e>): RuleElementPF2e[] {
        const rules: RuleElementPF2e[] = [];
        for (const data of item.data.data.rules) {
            const key = data.key.replace(/^PF2E\.RuleElement\./, "");
            const REConstructor = this.custom[key] ?? this.custom[data.key] ?? this.builtin[key];
            if (REConstructor) {
                const rule = ((): RuleElementPF2e | null => {
                    try {
                        return new REConstructor(data, item);
                    } catch (error) {
                        console.warn(`PF2e System | Failed to construct rule element ${data.key}`);
                        console.warn(error);
                        return null;
                    }
                })();
                if (rule) rules.push(rule);
            } else if (data.key !== "NewRuleElement") {
                console.warn(`PF2e System | Unrecognized rule element ${data.key}`);
            }
        }
        return rules;
    }
}

type RuleElementConstructor = new (data: RuleElementSource, item: Embedded<ItemPF2e>) => RuleElementPF2e;
