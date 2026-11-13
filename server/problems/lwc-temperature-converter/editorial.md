## Approach

Two fields hold what each input shows. Editing one sets its own field to exactly what was typed and **derives** the other.

- Keep what the user typed as-is in their own box; only the *other* box is rounded. Re-formatting the box someone is typing in moves their cursor and fights them.
- `Math.round(n * 10) / 10` rounds to one decimal; `String(212)` is `"212"`, so whole numbers show no `.0`.
- An empty input clears the other one; `Number("")` would otherwise turn it into 0.

## Solution

**tempConverter.css**

```css
label { display: block; margin-bottom: 0.5rem; }
```

**tempConverter.html**

```html
<template>
    <label>Celsius <input class="celsius" type="number" value={celsius} oninput={fromCelsius} /></label>
    <label>Fahrenheit <input class="fahrenheit" type="number" value={fahrenheit} oninput={fromFahrenheit} /></label>
</template>
```

**tempConverter.js**

```javascript
import { LightningElement } from "lwc";

const round = (n) => String(Math.round(n * 10) / 10);

export default class TempConverter extends LightningElement {
    celsius = "";
    fahrenheit = "";

    fromCelsius(event) {
        const value = event.target.value;
        this.celsius = value;
        if (value === "") this.fahrenheit = "";
        else if (!Number.isNaN(Number(value))) this.fahrenheit = round((Number(value) * 9) / 5 + 32);
    }

    fromFahrenheit(event) {
        const value = event.target.value;
        this.fahrenheit = value;
        if (value === "") this.celsius = "";
        else if (!Number.isNaN(Number(value))) this.celsius = round(((Number(value) - 32) * 5) / 9);
    }
}
```
