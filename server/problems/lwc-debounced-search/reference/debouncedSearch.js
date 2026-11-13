import { LightningElement, api } from "lwc";

export default class DebouncedSearch extends LightningElement {
    @api delay = 300;
    text = "";
    lastTerm = "";
    pending = false;
    timer;

    handleInput(event) {
        this.text = event.target.value;
        clearTimeout(this.timer);
        this.pending = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation -- debouncing user input
        this.timer = setTimeout(() => this.fire(), this.delay);
    }

    fire() {
        this.pending = false;
        const term = this.text.trim();
        if (!term || term === this.lastTerm) return;
        this.lastTerm = term;
        this.dispatchEvent(new CustomEvent("search", { detail: term }));
    }

    disconnectedCallback() {
        clearTimeout(this.timer);
    }
}
