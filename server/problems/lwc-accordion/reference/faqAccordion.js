import { LightningElement, api } from "lwc";

export default class FaqAccordion extends LightningElement {
    @api sections = [];
    @api allowMultiple = false;
    openIds = [];

    get rows() {
        return (this.sections || []).map((s) => {
            const expanded = this.openIds.includes(s.id);
            return { ...s, expanded, ariaExpanded: expanded ? "true" : "false" };
        });
    }

    toggle(event) {
        const id = event.currentTarget.dataset.id;
        if (this.openIds.includes(id)) {
            this.openIds = this.openIds.filter((x) => x !== id);
        } else {
            this.openIds = this.allowMultiple ? [...this.openIds, id] : [id];
        }
    }
}
