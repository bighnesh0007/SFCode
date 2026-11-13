import { LightningElement, api } from "lwc";

export default class SimpleTabs extends LightningElement {
    @api tabs = [];
    selected = 0;

    get items() {
        return (this.tabs || []).map((t, index) => ({
            index,
            label: t.label,
            selected: index === this.selected ? "true" : "false",
            className: index === this.selected ? "tab active" : "tab",
        }));
    }

    get current() {
        return (this.tabs || [])[this.selected];
    }

    select(event) {
        this.selected = Number(event.currentTarget.dataset.index);
    }

    handleKey(event) {
        const n = (this.tabs || []).length;
        if (n === 0) return;
        if (event.key === "ArrowRight") this.selected = (this.selected + 1) % n;
        else if (event.key === "ArrowLeft") this.selected = (this.selected - 1 + n) % n;
    }
}
