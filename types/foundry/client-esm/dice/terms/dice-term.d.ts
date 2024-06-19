import type { RollTerm } from "./roll-term.js";

/**
 * An abstract base class for any type of RollTerm which involves randomized input from dice, coins, or other devices.
 * @param termData Data used to create the Dice Term, including the following:
 * @param [termData.number=1]  The number of dice of this term to roll, before modifiers are applied
 * @param termData.faces       The number of faces on each die of this type
 * @param [termData.modifiers] An array of modifiers applied to the results
 * @param [termData.results]   An optional array of pre-cast results for the term
 * @param [termData.options]   Additional options that modify the term
 */
export abstract class DiceTerm<TData extends DiceTermData = DiceTermData> extends RollTerm<TData> {
    constructor({ number, faces, method, modifiers, results, options }?: TData);

    /** The resolution method used to resolve this DiceTerm.*/
    get method(): string;

    set method(method: string);

    #method: string;

    /** An Array of dice term modifiers which are applied */
    modifiers: string[];

    /** The array of dice term results which have been rolled */
    results: DiceTermResult[];

    /** Define the denomination string used to register this DiceTerm type in CONFIG.Dice.terms */
    static DENOMINATION: string;

    /** Define the named modifiers that can be applied for this particular DiceTerm type. */
    static MODIFIERS: Record<string, string | ((term: DiceTermResult) => void)>;

    /**
     * A regular expression pattern which captures the full set of term modifiers
     * Anything until a space, group symbol, or arithmetic operator
     */
    static MODIFIERS_REGEXP_STRING: string;

    /**
     * A regular expression used to separate individual modifiers
     */
    static MODIFIER_REGEXP: RegExp;

    static override REGEXP: RegExp;

    /** System note: contents are ["number", "faces", "modifiers", "results"] */
    static override SERIALIZE_ATTRIBUTES: string[];

    /* -------------------------------------------- */
    /*  Dice Term Attributes                        */
    /* -------------------------------------------- */

    /**
     * The number of dice of this term to roll. Returns undefined if the number is a complex term
     * that has not yet been evaluated.
     */
    get number(): number | undefined;

    /** The number of dice of this term to roll, before modifiers are applied */
    protected _number: number;

    set number(value: number);

    /**
     * The number of faces on the die. Returns undefined if the faces are represented as a complex term
     * that has not yet been evaluated.
     */
    get faces(): TData["faces"] | undefined;

    /**
     * The number of faces on the die, or a Roll instance that will be evaluated to a number.
     */
    protected _faces: TData["faces"] | Roll;

    set faces(value: number | Roll);

    override get expression(): string;

    /** The denomination of this DiceTerm instance. */
    get denomination(): string;

    /** An array of additional DiceTerm instances involved in resolving this DiceTerm. */
    get dice(): DiceTerm[];

    override get total(): number | undefined;

    /** Return an array of rolled values which are still active within this term */
    get values(): number[];

    override get isDeterministic(): false;

    /* -------------------------------------------- */
    /*  Dice Term Methods                           */
    /* -------------------------------------------- */

    /**
     * Alter the DiceTerm by adding or multiplying the number of dice which are rolled
     * @param multiply A factor to multiply. Dice are multiplied before any additions.
     * @param add      A number of dice to add. Dice are added after multiplication.
     * @return The altered term
     */
    alter(multiply: number, add: number): this;

    protected override _evaluate(): Promise<Evaluated<this>>;

    /**
     * Evaluate this dice term asynchronously.
     * @param [options]  Options forwarded to inner Roll evaluation.
     * @returns          A Promise which resolves to the evaluated DiceTerm instance.
     */
    protected _evaluateAsync({
        minimize,
        maximize,
        allowStrings,
        allowInteractive,
    }?: EvaluateRollParams): Promise<Evaluated<this>>;

    /**
     * Evaluate deterministic values of this term synchronously.
     * @param [options]
     * @param [options.maximize]    Force the result to be maximized.
     * @param [options.minimize]    Force the result to be minimized.
     * @param [options.strict]      Throw an error if attempting to evaluate a die term in a way that cannot be
     *                              done synchronously.
     * @returns                     The evaluated term
     */
    protected _evaluateSync({
        maximize,
        minimize,
        strict,
    }?: Omit<EvaluateSyncRollParams, "allowStrings">): Evaluated<this>;

    /**
     * Roll the DiceTerm by mapping a random uniform draw against the faces of the dice term.
     * @param [options={}] Options which modify how a random result is produced
     * @param [options.minimize=false] Minimize the result, obtaining the smallest possible value.
     * @param [options.maximize=false] Maximize the result, obtaining the largest possible value.
     * @return The produced result
     */
    roll({ minimize, maximize }?: { minimize?: boolean; maximize?: boolean }): Promise<DiceTermResult>;

    /**
     * Generate a roll result value for this DiceTerm based on its fulfillment method.
     * @param [options] Options forwarded to the fulfillment method handler.
     * @returns         Returns a Promise that resolves to the fulfilled number, or undefined if it could not be fulfilled.
     */
    protected _roll({ minimize, maximize }?: { minimize?: boolean; maximize?: boolean }): Promise<number | void>;

    /**
     * Invoke the configured fulfillment handler for this term to produce a result value.
     * @param [options] Options forwarded to the fulfillment method handler.
     * @returns         Returns a Promise that resolves to the fulfilled number, or undefined if it could not be fulfilled.
     */
    #invokeFulfillmentHandler({
        minimize,
        maximize,
    }?: {
        minimize?: boolean;
        maximize?: boolean;
    }): Promise<number | void>;

    /**
     * Maps a randomly-generated value in the interval [0, 1) to a face value on the die.
     * @param randomUniform A value to map. Must be in the interval [0, 1).
     * @returns             The face value.
     */
    mapRandomFace(randomUniform: number): number;

    /**
     * Generate a random face value for this die using the configured PRNG.
     * @returns The face value.
     */
    randomFace(): number;

    /**
     * Return a string used as the label for each rolled result
     * @param result The rolled result
     * @return The result label
     */
    getResultLabel(result: DiceTermResult): string;

    /**
     * Get the CSS classes that should be used to display each rolled result
     * @param result The rolled result
     * @return The desired classes
     */
    getResultCSS(result: DiceTermResult): (string | null)[];

    /**
     * Render the tooltip HTML for a Roll instance
     * @return The data object used to render the default tooltip template for this DiceTerm
     */
    getTooltipData(): DiceTermTooltipData;

    /* -------------------------------------------- */
    /*  Modifier Methods                            */
    /* -------------------------------------------- */

    /**
     * Sequentially evaluate each dice roll modifier by passing the term to its evaluation function
     * Augment or modify the results array.
     */
    protected _evaluateModifiers(): Promise<void>;

    /**
     * Asynchronously evaluate a single modifier command, recording it in the array of evaluated modifiers
     * @param command  The parsed modifier command
     * @param modifier The full modifier request
     */
    protected _evaluateModifier(command: string, modifier: string): Promise<void>;

    /**
     * A helper comparison function.
     * Returns a boolean depending on whether the result compares favorably against the target.
     * @param result     The result being compared
     * @param comparison The comparison operator in [=,<,<=,>,>=]
     * @param target     The target value
     * @return Is the comparison true?
     */
    static compareResult(result: number, comparison: ComparisonOperator, target?: number): boolean;

    /**
     * A helper method to modify the results array of a dice term by flagging certain results are kept or dropped.
     * @param results   The results array
     * @param number    The number to keep or drop
     * @param [keep]    Keep results?
     * @param [highest] Keep the highest?
     * @return The modified results array
     */
    protected static _keepOrDrop<T extends DiceTermResult>(
        results: T[],
        number: number,
        { keep, highest }?: { keep?: boolean; highest?: boolean },
    ): T[];

    /**
     * A reusable helper function to handle the identification and deduction of failures
     */
    protected static _applyCount<T extends DiceTermResult>(
        results: T,
        comparison: ComparisonOperator,
        target: number,
        { flagSuccess, flagFailure }?: { flagSuccess?: boolean; flagFailure?: boolean },
    ): void;

    /** A reusable helper function to handle the identification and deduction of failures */
    protected static _applyDeduct<T extends DiceTermResult>(
        results: T[],
        comparison: ComparisonOperator,
        target: number,
        { deductFailure, invertFailure }?: { deductFailure?: boolean; invertFailure?: boolean },
    ): void;

    /* -------------------------------------------- */
    /*  Factory Methods                             */
    /* -------------------------------------------- */

    /**
     * Determine whether a string expression matches this type of term
     * @param expression The expression to parse
     * @param [options={}] Additional options which customize the match
     * @param [options.imputeNumber=true] Allow the number of dice to be optional, i.e. "d6"
     */
    static matchTerm(expression: string, { imputeNumber }?: { imputeNumber: boolean }): RegExpMatchArray | null;

    /**
     * Construct a term of this type given a matched regular expression array.
     * @param match The matched regular expression array
     * @return The constructed term
     */
    static fromMatch<T extends DiceTerm>(this: ConstructorOf<T>, match: RegExpMatchArray): T;

    static override fromParseNode(node: RollParseNode): DiceTerm;

    /* -------------------------------------------- */
    /*  Serialization & Loading                     */
    /* -------------------------------------------- */

    override toJSON(): TData;

    static override _fromData<D extends DiceTermData, T extends RollTerm<D>>(this: ConstructorOf<T>, data: D): T;
}

declare global {
    /**
     * @property result      The numeric result
     * @property [active]    Is this result active, contributing to the total?
     * @property [count]     A value that the result counts as, otherwise the result is not used directly as
     * @property [success]   Does this result denote a success?
     * @property [failure]   Does this result denote a failure?
     * @property [discarded] Was this result discarded?
     * @property [rerolled]  Was this result rerolled?
     * @property [exploded]  Was this result exploded?
     */
    interface DiceTermResult {
        result: number;
        active?: boolean;
        count?: number;
        success?: boolean;
        failure?: boolean;
        discarded?: boolean;
        rerolled?: boolean;
        exploded?: boolean;
    }

    interface DiceTermData extends RollTermData {
        number?: number;
        faces?: number;
        method?: string;
        modifiers?: string[];
        results?: DiceTermResult[];
    }

    type ComparisonOperator = "=" | "<" | "<=" | ">" | ">=";

    interface DiceTermTooltipData {
        total: number;
        faces: number;
        flavor: string;
        icon: string | null;
        method: string | undefined;
        formula: string;
        rolls: {
            result: string;
            classes: string;
        };
    }
}
