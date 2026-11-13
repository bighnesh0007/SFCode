import { LightningElement, api } from "lwc";

export default class CartSummary extends LightningElement {
    cart = [];

    @api
    get items() {
        return this.cart;
    }
    set items(value) {
        this.cart = (value || []).map((i) => ({ ...i }));
    }

    get hasItems() {
        return this.cart.length > 0;
    }

    get rows() {
        return this.cart.map((i) => ({ ...i, subtotal: (i.price * i.quantity).toFixed(2) }));
    }

    get total() {
        return this.cart.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2);
    }

    increment(event) {
        const id = event.currentTarget.dataset.id;
        this.update(this.cart.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)));
    }

    decrement(event) {
        const id = event.currentTarget.dataset.id;
        const next = this.cart.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
        this.update(next.filter((i) => i.quantity > 0));
    }

    update(next) {
        this.cart = next;
        this.dispatchEvent(new CustomEvent("change", { detail: next.map(({ id, quantity }) => ({ id, quantity })) }));
    }
}
