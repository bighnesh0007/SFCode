import { LightningElement, api } from "lwc";

export default class CharCounter extends LightningElement {
    @api max = 140;
    text = "";

    get used() {
        return this.text.length;
    }

    get counterClass() {
        return this.used > this.max ? "counter over" : "counter";
    }

    get remainingText() {
        const left = this.max - this.used;
        const n = Math.abs(left);
        const word = n === 1 ? "character" : "characters";
        return left >= 0 ? `${n} ${word} left` : `${n} ${word} over`;
    }

    handleInput(event) {
        this.text = event.target.value;
    }
}
