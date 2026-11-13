## Approach

The component keeps **its own copy** of the items. An `@api` setter is where that copy is made: whenever the parent passes a new array, the setter clones it, so incrementing never mutates the parent's objects (which in Salesforce are read-only proxies and would throw).

- Every change replaces `this.cart` with a new array, which re-renders and keeps the logic easy to follow.
- Money is formatted with `toFixed(2)` in getters, because templates can't call functions.
- The `change` event reports the new quantities upward, so the parent can save them. The parent stays in charge of what's persisted.

## Solution

**cartSummary.css**

```css
.item { display: flex; gap: 0.5rem; align-items: center; }
.total { font-weight: bold; }
```

**cartSummary.html**

```html
<template>
    <template lwc:if={hasItems}>
        <ul>
            <template for:each={rows} for:item="item">
                <li key={item.id} class="item">
                    <span class="name">{item.name}</span>
                    <button class="dec" data-id={item.id} onclick={decrement}>-</button>
                    <span class="qty">{item.quantity}</span>
                    <button class="inc" data-id={item.id} onclick={increment}>+</button>
                    <span class="subtotal">{item.subtotal}</span>
                </li>
            </template>
        </ul>
        <p class="total">Total: {total}</p>
    </template>
    <template lwc:else>
        <p class="empty">Your cart is empty</p>
    </template>
</template>
```

**cartSummary.js**

```javascript
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
```
