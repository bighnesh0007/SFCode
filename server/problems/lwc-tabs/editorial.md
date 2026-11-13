## Approach

- **State:** just the selected index. Labels, classes and ARIA attributes are derived in a getter.
- **ARIA:** `role=tablist`, `role=tab`, `role=tabpanel` and `aria-selected` tell screen readers what this widget is and which tab is active. Use the strings `"true"` and `"false"`.
- **Keyboard:** one `keydown` handler on the tablist. Modulo arithmetic wraps around; add `n` before `%` when going left so the result never goes negative.
- **Empty input:** `lwc:if={current}` renders no panel when there's nothing to show.

## Solution

**simpleTabs.html**

```html
<template>
    <div role="tablist" onkeydown={handleKey}>
        <template for:each={items} for:item="tab">
            <button key={tab.index} class={tab.className} role="tab" aria-selected={tab.selected} data-index={tab.index} onclick={select}>
                {tab.label}
            </button>
        </template>
    </div>
    <template lwc:if={current}>
        <div class="panel" role="tabpanel">{current.content}</div>
    </template>
</template>
```

**simpleTabs.js**

```javascript
import { LightningElement, api } from "lwc";

export default class SimpleTabs extends LightningElement {
    @api tabs = [];
    selected = 0;

    get items() {
        return (this.tabs || []).map((t, index) => ({
            index,
            label: t.label,
            selected: index === this.selected ? "true" : "false",
            className: index === this.selected ? "tab active" : "tab",
        }));
    }

    get current() {
        return (this.tabs || [])[this.selected];
    }

    select(event) {
        this.selected = Number(event.currentTarget.dataset.index);
    }

    handleKey(event) {
        const n = (this.tabs || []).length;
        if (n === 0) return;
        if (event.key === "ArrowRight") this.selected = (this.selected + 1) % n;
        else if (event.key === "ArrowLeft") this.selected = (this.selected - 1 + n) % n;
    }
}
```

**simpleTabs.css**

```css
.tab { padding: 0.5rem 1rem; border: none; background: none; }
.active { border-bottom: 2px solid #0176d3; font-weight: 600; }
```
