export const DropCanvasData = {
    listen: (): void => {
        Hooks.on("dropCanvasData", (_canvas, data) => {
            if (!(data.type === "Item" || data.type === "PersistentDamage")) {
                return true;
            }

            const dropTarget = [...canvas.tokens.placeables]
                .sort((a, b) => b.document.sort - a.document.sort)
                .sort((a, b) => b.document.elevation - a.document.elevation)
                .find((t) => t.visible && t.bounds.contains(data.x, data.y));

            const actor = dropTarget?.actor;
            if (actor) {
                const dataTransfer = new DataTransfer();
                dataTransfer.setData("text/plain", JSON.stringify(data));
                const event = new DragEvent("drop", { altKey: game.keyboard.isModifierActive("Alt"), dataTransfer });
                actor.sheet._onDrop(event);
                return false; // Prevent modules from doing anything further
            }

            return true;
        });
    },
};
