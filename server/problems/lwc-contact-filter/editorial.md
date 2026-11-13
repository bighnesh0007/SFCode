## Approach

Keep the **term** as state and derive everything else with getters: `matches`, `total`, `hasMatches`. When the term changes, every getter re-runs on the next render, so there's no second copy of the list to keep in sync.

- Case-insensitive: lower-case both sides.
- `for:each` needs a unique `key` on the repeated element.
- `lwc:if={hasMatches}` with `lwc:else` replaces the older `if:true`/`if:false`.
- `this.contacts || []` guards against a parent passing `null`.

## Solution

**contactFilter.html**

```html
<template>
    <input class="search" type="search" placeholder="Search contacts" oninput={handleSearch} />
    <p class="summary">{matches.length} of {total} contacts</p>
    <template lwc:if={hasMatches}>
        <ul>
            <template for:each={matches} for:item="contact">
                <li key={contact.id} class="contact">{contact.name}</li>
            </template>
        </ul>
    </template>
    <template lwc:else>
        <p class="empty">No contacts match.</p>
    </template>
</template>
```

**contactFilter.js**

```javascript
import { LightningElement, api } from "lwc";

export default class ContactFilter extends LightningElement {
    @api contacts = [];
    term = "";

    get matches() {
        const term = this.term.toLowerCase();
        return (this.contacts || []).filter((c) => c.name.toLowerCase().includes(term));
    }

    get total() {
        return (this.contacts || []).length;
    }

    get hasMatches() {
        return this.matches.length > 0;
    }

    handleSearch(event) {
        this.term = event.target.value;
    }
}
```
