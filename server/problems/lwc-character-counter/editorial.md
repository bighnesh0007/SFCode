## Approach

One piece of state, the **text**, and everything else derived with getters. Templates can't compute, so the class string and the message are getters too.

- `class={counterClass}` swaps between `counter` and `counter over`.
- `>` rather than `>=` makes exactly `max` not count as over.
- Pluralising is part of the spec: test the 1 case specifically.

## Solution

**charCounter.html**

```html
<template>
    <textarea class="input" oninput={handleInput}></textarea>
    <p class={counterClass}>{used}/{max}</p>
    <p class="remaining">{remainingText}</p>
</template>
```

**charCounter.js**

```javascript
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
```

**charCounter.css**

```css
.over { color: #c23934; font-weight: 600; }
```
