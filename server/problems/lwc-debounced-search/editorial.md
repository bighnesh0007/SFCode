## Approach

A **debounce** delays an action until input has been quiet for a while. Each keystroke cancels the pending timer and starts a fresh one, so only the last keystroke's timer survives long enough to fire.

- Keep the timer id in a field so the next keystroke can `clearTimeout` it.
- The `pending` flag drives the "Searching…" indicator; set it when a timer starts and clear it when it fires. Because it's a field, changing it re-renders.
- `lastTerm` suppresses repeats: typing "ab", deleting to "a" and retyping "ab" within one pause would otherwise search for "ab" twice.
- **`disconnectedCallback`** is the cleanup hook. A timer outlives its component unless you clear it, and a late event from a removed component is a classic source of "ghost" bugs.
- In a real org, the `@lwc/lwc/no-async-operation` lint rule flags `setTimeout`; add a disable comment saying it's a debounce.

## Solution

**debouncedSearch.css**

```css
.pending { margin-left: 0.5rem; color: #706e6b; }
```

**debouncedSearch.html**

```html
<template>
    <input class="search" type="search" placeholder="Search" oninput={handleInput} />
    <template lwc:if={pending}>
        <span class="pending">Searching…</span>
    </template>
</template>
```

**debouncedSearch.js**

```javascript
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
```
