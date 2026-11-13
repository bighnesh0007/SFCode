## Approach

The only state is **which sections are open**. Everything the template shows is derived from it in a getter, so the headers, `aria-expanded` and bodies can't disagree.

- `aria-expanded` tells screen-reader users whether the button's content is shown. It must change with the state, which is why it's computed per section.
- Use a real `<button>`: it is focusable and responds to Enter and Space with no extra code.
- Replacing `openIds` with a new array (rather than pushing into it) makes the change obvious and keeps the "only one open" rule a one-liner.

## Solution

**faqAccordion.css**

```css
.header { display: block; width: 100%; text-align: left; padding: 0.5rem; }
.body { padding: 0.5rem 1rem; }
```

**faqAccordion.html**

```html
<template>
    <template for:each={rows} for:item="section">
        <div key={section.id} class="section">
            <button class="header" data-id={section.id} aria-expanded={section.ariaExpanded} onclick={toggle}>{section.title}</button>
            <template lwc:if={section.expanded}>
                <div class="body">{section.body}</div>
            </template>
        </div>
    </template>
</template>
```

**faqAccordion.js**

```javascript
import { LightningElement, api } from "lwc";

export default class FaqAccordion extends LightningElement {
    @api sections = [];
    @api allowMultiple = false;
    openIds = [];

    get rows() {
        return (this.sections || []).map((s) => {
            const expanded = this.openIds.includes(s.id);
            return { ...s, expanded, ariaExpanded: expanded ? "true" : "false" };
        });
    }

    toggle(event) {
        const id = event.currentTarget.dataset.id;
        if (this.openIds.includes(id)) {
            this.openIds = this.openIds.filter((x) => x !== id);
        } else {
            this.openIds = this.allowMultiple ? [...this.openIds, id] : [id];
        }
    }
}
```
