## Approach

The city list is **derived** from the chosen country, so it lives in a getter rather than being copied into a field each time the country changes.

- `disabled={noCountry}` keeps users from picking a city first.
- Binding `value={city}` matters: when the country changes and `city` goes back to `''`, the select shows the placeholder again instead of a stale city.
- The event fires only once both values are known, so the parent receives a complete location.

## Solution

**locationPicker.css**

```css
select { display: block; margin-bottom: 0.5rem; }
```

**locationPicker.html**

```html
<template>
    <select class="country" onchange={handleCountry}>
        <option value="">Choose a country</option>
        <template for:each={countries} for:item="c">
            <option key={c.name} value={c.name}>{c.name}</option>
        </template>
    </select>
    <select class="city" disabled={noCountry} value={city} onchange={handleCity}>
        <option value="">Choose a city</option>
        <template for:each={cities} for:item="name">
            <option key={name} value={name}>{name}</option>
        </template>
    </select>
</template>
```

**locationPicker.js**

```javascript
import { LightningElement, api } from "lwc";

export default class LocationPicker extends LightningElement {
    @api countries = [];
    country = "";
    city = "";

    get noCountry() {
        return !this.country;
    }

    get cities() {
        const match = (this.countries || []).find((c) => c.name === this.country);
        return match ? match.cities : [];
    }

    handleCountry(event) {
        this.country = event.target.value;
        this.city = "";
    }

    handleCity(event) {
        this.city = event.target.value;
        if (this.city) {
            this.dispatchEvent(new CustomEvent("select", { detail: { country: this.country, city: this.city } }));
        }
    }
}
```
