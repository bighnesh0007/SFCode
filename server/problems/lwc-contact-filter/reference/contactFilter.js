import { LightningElement, api } from "lwc";

export default class ContactFilter extends LightningElement {
    @api contacts = [];
    term = "";

    get matches() {
        const term = this.term.toLowerCase();
        return (this.contacts || []).filter((c) => c.name.toLowerCase().includes(term));
    }

    get total() {
        return (this.contacts || []).length;
    }

    get hasMatches() {
        return this.matches.length > 0;
    }

    handleSearch(event) {
        this.term = event.target.value;
    }
}
