## Approach

A single boolean decides everything; getters turn it into the visible text, the button label and `aria-expanded`.

- `aria-expanded` tells assistive technology whether the extra content is shown, so it must flip with the state.
- Not rendering the button for short text avoids a control that does nothing.
- Use the real ellipsis character `…` rather than three dots so it reads as one symbol.

## Solution

**showMore.css**

```css
.toggle { background: none; border: none; color: #0176d3; cursor: pointer; padding: 0; }
```

**showMore.html**

```html
<template>
    <p class="text">{shown}</p>
    <template lwc:if={needsToggle}>
        <button class="toggle" aria-expanded={ariaExpanded} onclick={toggle}>{label}</button>
    </template>
</template>
```

**showMore.js**

```javascript
import { LightningElement, api } from "lwc";

export default class ShowMore extends LightningElement {
    @api text = "";
    @api limit = 100;
    expanded = false;

    get needsToggle() {
        return (this.text || "").length > this.limit;
    }

    get shown() {
        const text = this.text || "";
        return this.expanded || !this.needsToggle ? text : `${text.slice(0, this.limit)}…`;
    }

    get label() {
        return this.expanded ? "Show less" : "Show more";
    }

    get ariaExpanded() {
        return this.expanded ? "true" : "false";
    }

    toggle() {
        this.expanded = !this.expanded;
    }
}
```
