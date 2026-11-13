## Approach

This is the **data down, events up** pattern:

- `@api value` comes **from the parent**. A child must not reassign its own `@api` property; the parent does that after hearing the event.
- A getter `stars` turns `value` into five `{ n, className }` objects, because templates have no loops over numbers and no expressions.
- `data-n={star.n}` stores the number on the button, and `event.currentTarget.dataset.n` reads it back as a string, hence `Number(...)`.
- `this.dispatchEvent(new CustomEvent('rate', { detail: n }))` tells the parent, which listens with `onrate={handler}`.

## Solution

**starRating.css**

```css
.star { font-size: 1.5rem; background: none; border: none; color: #bbb; cursor: pointer; }
.selected { color: #f5a623; }
```

**starRating.html**

```html
<template>
    <template for:each={stars} for:item="star">
        <button key={star.n} class={star.className} data-n={star.n} onclick={handleClick}>★</button>
    </template>
</template>
```

**starRating.js**

```javascript
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
```
