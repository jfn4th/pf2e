import type { DiceTerm } from "./dice-term.d.ts";
import type { Die } from "./die.d.ts";

/**
 * Define a three-sided Fate/Fudge dice term that can be used as part of a Roll formula
 * Mathematically behaves like 1d3-2
 */
export class FateDie extends DiceTerm<FateDieData> {
    constructor(termData: DiceTermData);

    static override DENOMINATION: "f";

    override roll({ minimize, maximize }?: { minimize?: boolean; maximize?: boolean }): Promise<DiceTermResult>;

    override mapRandomFace(randomUniform: number): -1 | 0 | 1;

    override getResultLabel<T extends DiceTermResult>(
        result: DiceTermResult,
    ): T["result"] extends -1 ? "-" : T extends 0 ? "&nbsp;" : T extends 1 ? "+" : never;
}

declare global {
    interface FateDieData extends DiceTerm {
        faces: 3;
    }
}
