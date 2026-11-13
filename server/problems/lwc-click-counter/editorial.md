## Approach

- `@api label = "Clicks"`: a public property with a default.
- `count = 0`: private state. Since Spring '20 every field is reactive, so `this.count += 1` re-renders and `@track` isn't needed.
- `onclick={increment}` and `onclick={reset}` bind handlers. In LWC templates you pass the function, not a call.
- `disabled={isZero}`: templates can't hold expressions like `count === 0`, so a **getter** computes it.

## Solution

**clickCounter.css**

```css
.count { font-weight: 600; }
```

**clickCounter.html**

```html
<template>
    <p class="count">{label}: {count}</p>
    <button class="increment" onclick={increment}>+1</button>
    <button class="reset" onclick={reset} disabled={isZero}>Reset</button>
</template>
```

**clickCounter.js**

```javascript
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
```
