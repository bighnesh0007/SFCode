import { LightningElement, api } from "lwc";

export default class StarRating extends LightningElement {
    @api value = 0;

    get stars() {
        return [1, 2, 3, 4, 5].map((n) => ({ n, className: n <= this.value ? "star selected" : "star" }));
    }

    handleClick(event) {
        const n = Number(event.currentTarget.dataset.n);
        this.dispatchEvent(new CustomEvent("rate", { detail: n }));
    }
}
