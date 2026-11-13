import { LightningElement, api } from "lwc";

export default class ShowMore extends LightningElement {
    @api text = "";
    @api limit = 100;
    expanded = false;

    get needsToggle() {
        return (this.text || "").length > this.limit;
    }

    get shown() {
        const text = this.text || "";
        return this.expanded || !this.needsToggle ? text : `${text.slice(0, this.limit)}…`;
    }

    get label() {
        return this.expanded ? "Show less" : "Show more";
    }

    get ariaExpanded() {
        return this.expanded ? "true" : "false";
    }

    toggle() {
        this.expanded = !this.expanded;
    }
}
