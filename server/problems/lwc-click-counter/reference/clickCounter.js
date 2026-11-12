import { LightningElement, api } from "lwc";

export default class ClickCounter extends LightningElement {
    @api label = "Clicks";
    count = 0;

    get isZero() {
        return this.count === 0;
    }

    increment() {
        this.count += 1;
    }

    reset() {
        this.count = 0;
    }
}
