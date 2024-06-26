import { ActorPF2e } from "@actor";
import { SAVE_TYPES } from "@actor/values.ts";
import { ItemPF2e } from "@item";
import { ActionTrait } from "@item/ability/types.ts";
import { EFFECT_AREA_SHAPES } from "@item/spell/values.ts";
import { ChatMessageFlagsPF2e, ChatMessagePF2e } from "@module/chat-message/index.ts";
import { calculateDC } from "@module/dc.ts";
import { eventToRollParams } from "@scripts/sheet-util.ts";
import { CheckDC } from "@system/degree-of-success.ts";
import { Statistic, StatisticRollParameters } from "@system/statistic/index.ts";
import { TextEditorPF2e } from "@system/text-editor.ts";
import { ErrorPF2e, getActionGlyph, htmlClosest, htmlQueryAll, sluggify, tupleHasValue } from "@util";
import { getSelectedActors } from "@util/token-actor-utils.ts";
import * as R from "remeda";

const inlineSelector = ["action", "check", "effect-area"].map((keyword) => `[data-pf2-${keyword}]`).join(",");

export class InlineRollLinks {
    static activatePF2eListeners(): void {
        document.addEventListener("click", (event) => {
            function getLinkOrSpan(attr: string) {
                return htmlClosest<HTMLAnchorElement | HTMLSpanElement>(event.target, `a[${attr}], span[${attr}]`);
            }

            // Handle repost (before everything else)
            const repostLink = htmlClosest(event.target, "i[data-pf2-repost]");
            if (repostLink) {
                event.preventDefault();
                const link = htmlClosest(repostLink, "a, span");
                if (link) {
                    this.#onRepostAction(link);
                }
                return;
            }

            // Handle inline check
            const checkLink = getLinkOrSpan("data-pf2-check");
            if (checkLink) {
                event.preventDefault();
                this.#onClickInlineCheck(event, checkLink);
                return;
            }

            const actionLink = getLinkOrSpan("data-pf2-action");
            if (actionLink) {
                event.preventDefault();
                this.#onClickInlineAction(event, actionLink);
                return;
            }

            const areaLink = getLinkOrSpan("data-pf2-effect-area");
            if (areaLink) {
                event.preventDefault();
                this.#onClickInlineTemplate(event, areaLink);
                return;
            }
        });
    }

    static injectRepostElements(html: HTMLElement, foundryDoc: ClientDocument | null): void {
        const links = htmlQueryAll(html, inlineSelector).filter((l) => ["A", "SPAN"].includes(l.nodeName));
        foundryDoc ??= resolveSheetDocument(html);
        for (const link of links) {
            if (!foundryDoc || foundryDoc.isOwner) link.classList.add("with-repost");

            const repostButtons = htmlQueryAll(link, "i[data-pf2-repost]");
            if (repostButtons.length > 0) {
                if (foundryDoc && !foundryDoc.isOwner) {
                    for (const button of repostButtons) {
                        button.remove();
                    }
                    link.classList.remove("with-repost");
                }
                continue;
            }

            if (foundryDoc && !foundryDoc.isOwner) continue;

            const newButton = document.createElement("i");
            const icon =
                link.parentElement?.dataset?.pf2Checkgroup !== undefined ? "fa-comment-alt-dots" : "fa-comment-alt";
            newButton.classList.add("fa-solid", icon);
            newButton.dataset.pf2Repost = "";
            newButton.title = game.i18n.localize("PF2E.Repost");
            link.appendChild(newButton);
        }
    }

    static #makeRepostHtml(target: HTMLElement, defaultVisibility: string): string {
        const flavor = game.i18n.localize(target.dataset.pf2RepostFlavor ?? "");
        const showDC = target.dataset.pf2ShowDc ?? defaultVisibility;
        return `<span data-visibility="${showDC}">${flavor}</span> ${target.outerHTML}`.trim();
    }

    static #onClickInlineAction(event: MouseEvent, link: HTMLAnchorElement | HTMLSpanElement): void {
        const { pf2Action, pf2Glyph, pf2Variant, pf2Dc, pf2ShowDc, pf2Skill } = link.dataset;

        const slug = sluggify(pf2Action ?? "");
        const visibility = pf2ShowDc ?? "all";
        const difficultyClass = Number.isNumeric(pf2Dc)
            ? { scope: "check", value: Number(pf2Dc) || 0, visibility }
            : pf2Dc;
        if (slug && game.pf2e.actions.has(slug)) {
            game.pf2e.actions
                .get(slug)
                ?.use({ event, variant: pf2Variant, difficultyClass, statistic: pf2Skill })
                .catch((reason: string) => ui.notifications.warn(reason));
        } else {
            const action = game.pf2e.actions[pf2Action ? sluggify(pf2Action, { camel: "dromedary" }) : ""];
            if (pf2Action && action) {
                action({
                    event,
                    glyph: pf2Glyph,
                    variant: pf2Variant,
                    difficultyClass,
                    skill: pf2Skill,
                });
            } else {
                console.warn(`PF2e System | Skip executing unknown action '${pf2Action}'`);
            }
        }
    }

    static async #onClickInlineCheck(event: MouseEvent, link: HTMLAnchorElement | HTMLSpanElement): Promise<void> {
        const { pf2Check, pf2Dc, pf2Traits, pf2Label, pf2Defense, pf2Adjustment, pf2Roller, pf2RollOptions } =
            link.dataset;
        const overrideTraits = "overrideTraits" in link.dataset;
        const targetOwner = "targetOwner" in link.dataset;

        if (!pf2Check) return;

        const foundryDoc = resolveDocument(link);
        const parent = resolveActor(foundryDoc, link);
        const actors = ((): ActorPF2e[] => {
            switch (pf2Roller) {
                case "self":
                    return parent?.canUserModify(game.user, "update") ? [parent] : [];
                case "party":
                    if (parent?.isOfType("party")) return [parent];
                    return R.compact([game.actors.party]);
            }

            // Use the DOM document as a fallback if it's an actor and the check isn't a saving throw
            const sheetActor = ((): ActorPF2e | null => {
                const maybeActor: ActorPF2e | null =
                    foundryDoc instanceof ActorPF2e
                        ? foundryDoc
                        : foundryDoc instanceof ItemPF2e && foundryDoc.actor
                          ? foundryDoc.actor
                          : null;
                return maybeActor?.isOwner && !maybeActor.isOfType("loot", "party") ? maybeActor : null;
            })();
            const rollingActors = [
                sheetActor ?? getSelectedActors({ exclude: ["loot"], assignedFallback: true }),
            ].flat();

            const isSave = tupleHasValue(SAVE_TYPES, pf2Check);
            if (parent?.isOfType("party") || (rollingActors.length === 0 && parent && !isSave)) {
                return [parent];
            }

            return rollingActors;
        })();

        if (actors.length === 0) {
            ui.notifications.error("PF2E.ErrorMessage.NoTokenSelected", { localize: true });
            return;
        }

        const extraRollOptions = [
            ...(pf2Traits?.split(",").map((o) => o.trim()) ?? []),
            ...(pf2RollOptions?.split(",").map((o) => o.trim()) ?? []),
        ];
        const eventRollParams = eventToRollParams(event, { type: "check" });
        const checkSlug = link.dataset.slug ? sluggify(link.dataset.slug) : null;

        switch (pf2Check) {
            case "flat": {
                for (const actor of actors) {
                    const flatCheck = new Statistic(actor, {
                        label: "",
                        slug: "flat",
                        modifiers: [],
                        check: { type: "flat-check" },
                    });
                    const dc = Number.isInteger(Number(pf2Dc)) ? { label: pf2Label, value: Number(pf2Dc) } : null;
                    flatCheck.roll({ ...eventRollParams, slug: checkSlug, extraRollOptions, dc });
                }
                break;
            }
            default: {
                const isSavingThrow = tupleHasValue(SAVE_TYPES, pf2Check);

                // Get actual traits for display in chat cards
                const traits = isSavingThrow
                    ? []
                    : extraRollOptions.filter((t): t is ActionTrait => t in CONFIG.PF2E.actionTraits) ?? [];

                for (const actor of actors) {
                    const statistic = ((): Statistic | null => {
                        if (pf2Check in CONFIG.PF2E.magicTraditions && actor.isOfType("creature")) {
                            const bestSpellcasting =
                                actor.spellcasting
                                    .filter((c) => c.tradition === pf2Check)
                                    .flatMap((s) => s.statistic ?? [])
                                    .sort((a, b) => b.check.mod - a.check.mod)
                                    .shift() ?? null;
                            if (bestSpellcasting) return bestSpellcasting;
                        }
                        return actor.getStatistic(pf2Check);
                    })();

                    if (!statistic) {
                        console.warn(ErrorPF2e(`Skip rolling unknown statistic ${pf2Check}`).message);
                        continue;
                    }

                    const targetActor = pf2Defense ? (targetOwner ? parent : game.user.targets.first()?.actor) : null;

                    const dcValue = (() => {
                        const adjustment = Number(pf2Adjustment) || 0;
                        if (pf2Dc === "@self.level") {
                            return calculateDC(actor.level) + adjustment;
                        }
                        return Number(pf2Dc ?? "NaN") + adjustment;
                    })();

                    const dc = ((): CheckDC | null => {
                        if (Number.isInteger(dcValue)) {
                            return { label: pf2Label, value: dcValue };
                        } else if (pf2Defense) {
                            const defenseStat = targetActor?.getStatistic(pf2Defense);
                            return defenseStat
                                ? {
                                      statistic: defenseStat.dc,
                                      scope: "check",
                                      value: defenseStat.dc.value,
                                  }
                                : null;
                        }
                        return null;
                    })();

                    // Retrieve the item if:
                    // (2) The item is an action or,
                    // (1) The check is a saving throw and the item is not a weapon.
                    // Exclude weapons so that roll notes on strikes from incapacitation abilities continue to work.
                    const item = (() => {
                        const itemFromDoc =
                            foundryDoc instanceof ItemPF2e
                                ? foundryDoc
                                : foundryDoc instanceof ChatMessagePF2e
                                  ? foundryDoc.item
                                  : null;

                        return itemFromDoc?.isOfType("action", "feat", "campaignFeature") ||
                            (isSavingThrow && !itemFromDoc?.isOfType("weapon"))
                            ? itemFromDoc
                            : null;
                    })();

                    const args: StatisticRollParameters = {
                        ...eventRollParams,
                        extraRollOptions,
                        origin: isSavingThrow && parent instanceof ActorPF2e ? parent : null,
                        dc,
                        target: !isSavingThrow && dc?.statistic ? targetActor : null,
                        item,
                        traits,
                    };

                    // Use a special header for checks against defenses
                    const itemIsEncounterAction =
                        !overrideTraits &&
                        !!(item?.isOfType("action", "feat") && item.actionCost) &&
                        !["flat-check", "saving-throw"].includes(statistic.check.type);
                    if (itemIsEncounterAction) {
                        const subtitleLocKey =
                            pf2Check in CONFIG.PF2E.magicTraditions
                                ? "PF2E.ActionsCheck.spell"
                                : statistic.check.type === "attack-roll"
                                  ? "PF2E.ActionsCheck.x-attack-roll"
                                  : "PF2E.ActionsCheck.x";
                        args.label = await renderTemplate("systems/pf2e/templates/chat/action/header.hbs", {
                            glyph: getActionGlyph(item.actionCost),
                            subtitle: game.i18n.format(subtitleLocKey, { type: statistic.label }),
                            title: item.name,
                        });
                        extraRollOptions.push(...TextEditorPF2e.createActionOptions(item));
                    }

                    statistic.roll(args);
                }
            }
        }
    }

    static #onClickInlineTemplate(_event: MouseEvent, link: HTMLAnchorElement | HTMLSpanElement): void {
        if (!canvas.ready) return;

        const templateConversion: Record<string, MeasuredTemplateType> = {
            burst: "circle",
            cone: "cone",
            cube: "rect",
            emanation: "circle",
            line: "ray",
            rect: "rect",
            square: "rect",
        } as const;

        const { pf2EffectArea, pf2Distance, pf2TemplateData, pf2Traits, pf2Width } = link.dataset;

        if (typeof pf2EffectArea !== "string") {
            console.warn(`PF2e System | Could not create template'`);
            return;
        }

        const foundryDoc = resolveDocument(link);
        const data: DeepPartial<foundry.documents.MeasuredTemplateSource> = JSON.parse(pf2TemplateData ?? "{}");
        data.distance ||= Number(pf2Distance);
        data.fillColor ||= game.user.color;
        data.t = templateConversion[pf2EffectArea];

        switch (data.t) {
            case "ray":
                data.width = Number(pf2Width) || CONFIG.MeasuredTemplate.defaults.width * canvas.dimensions.distance;
                break;
            case "cone":
                data.angle ||= CONFIG.MeasuredTemplate.defaults.angle;
                break;
            case "rect": {
                const distance = data.distance ?? 0;
                data.distance = Math.hypot(distance, distance);
                data.width = distance;
                data.direction = 45;
                break;
            }
        }

        const flags: { pf2e: Record<string, unknown> } = {
            pf2e: {},
        };

        const normalSize = (Math.ceil(data.distance) / 5) * 5 || 5;
        if (tupleHasValue(EFFECT_AREA_SHAPES, pf2EffectArea) && data.distance === normalSize) {
            flags.pf2e.areaShape = pf2EffectArea;
        }

        const messageId =
            foundryDoc instanceof ChatMessagePF2e
                ? foundryDoc.id
                : htmlClosest(link, "[data-message-id]")?.dataset.messageId ?? null;
        if (messageId) {
            flags.pf2e.messageId = messageId;
        }

        const actor = resolveActor(foundryDoc, link);
        if (actor || pf2Traits) {
            const origin: Record<string, unknown> = {};
            if (actor) {
                origin.actor = actor.uuid;
            }
            if (pf2Traits) {
                origin.traits = pf2Traits.split(",");
            }
            flags.pf2e.origin = origin;
        }

        if (!R.isEmpty(flags.pf2e)) {
            data.flags = flags;
        }

        canvas.templates.createPreview(data);
    }

    static async #onRepostAction(target: HTMLElement): Promise<ChatMessagePF2e | undefined> {
        if (!["pf2Action", "pf2Check", "pf2EffectArea"].some((d) => d in target.dataset)) {
            return;
        }

        const foundryDoc = resolveDocument(target);
        const actor = resolveActor(foundryDoc, target);
        const defaultVisibility = (actor ?? foundryDoc)?.hasPlayerOwner ? "all" : "gm";
        const content = (() => {
            if (target.parentElement?.dataset?.pf2Checkgroup !== undefined) {
                const content = htmlQueryAll(target.parentElement, inlineSelector)
                    .map((target) => this.#makeRepostHtml(target, defaultVisibility))
                    .join("<br>");

                return `<div data-pf2-checkgroup>${content}</div>`;
            } else {
                return this.#makeRepostHtml(target, defaultVisibility);
            }
        })();

        const speaker = actor
            ? ChatMessagePF2e.getSpeaker({ actor, token: actor.getActiveTokens(true, true).shift() })
            : ChatMessagePF2e.getSpeaker();

        // If the originating document is a journal entry, include its UUID as a flag. If a chat message, copy over
        // the origin flag.
        const message = game.messages.get(htmlClosest(target, "[data-message-id]")?.dataset.messageId ?? "");
        const flags: DeepPartial<ChatMessageFlagsPF2e> =
            foundryDoc instanceof JournalEntry
                ? { pf2e: { journalEntry: foundryDoc.uuid } }
                : message?.flags.pf2e.origin
                  ? { pf2e: { origin: fu.deepClone(message.flags.pf2e.origin) } }
                  : {};

        return ChatMessagePF2e.create({ speaker, content, flags });
    }

    /** Give inline damage-roll links from items flavor text of the item name */
    static flavorDamageRolls(html: HTMLElement, document: ClientDocument | null = null): void {
        const actor = resolveActor(document, html);
        for (const rollLink of htmlQueryAll(html, "a.inline-roll[data-damage-roll]")) {
            const itemId = htmlClosest(rollLink, "[data-item-id]")?.dataset.itemId;
            const item = actor?.items.get(itemId ?? "");
            if (item) rollLink.dataset.flavor ||= item.name;
        }
    }
}

function resolveSheetDocument(html: HTMLElement): ClientDocument | null {
    const sheet: { id?: string; document?: unknown } | null =
        ui.windows[Number(html.closest<HTMLElement>(".app.sheet")?.dataset.appid)] ?? null;
    const doc = sheet?.document;
    return doc && (doc instanceof ActorPF2e || doc instanceof ItemPF2e || doc instanceof JournalEntry) ? doc : null;
}

/** If the provided document exists returns it, otherwise attempt to derive it from the sheet */
function resolveDocument(html: HTMLElement): ClientDocument | null {
    // Retrieve the sheet document first
    const sheetDocument = resolveSheetDocument(html);

    // Items are often embedded, so it has priority
    const itemId = htmlClosest(html, "[data-item-id]")?.dataset.itemId;
    if (itemId && sheetDocument instanceof ActorPF2e) {
        return sheetDocument.items.get(itemId) ?? null;
    }

    return sheetDocument;
}

/** Retrieve an actor via a passed document or item UUID in the dataset of a link */
function resolveActor(foundryDoc: ClientDocument | null, anchor: HTMLElement): ActorPF2e | null {
    if (foundryDoc instanceof ActorPF2e) return foundryDoc;
    if (foundryDoc instanceof ItemPF2e || foundryDoc instanceof ChatMessagePF2e) return foundryDoc.actor;

    // Retrieve item/actor from anywhere via UUID
    const itemUuid = anchor.dataset.itemUuid;
    const itemByUUID = itemUuid && !itemUuid.startsWith("Compendium.") ? fromUuidSync(itemUuid) : null;
    return itemByUUID instanceof ItemPF2e ? itemByUUID.actor : null;
}
