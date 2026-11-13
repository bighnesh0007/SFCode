## Approach

One field holds the password; **all** the output comes from getters, so it can never fall out of step with what was typed.

- Each rule is a small regular expression. `[^A-Za-z0-9]` means "anything that isn't a letter or a digit", which covers every symbol.
- The class for the meter is computed in a getter (`strength weak`), because templates have no expressions.
- Showing the unmet rules, not just a score, tells the user what to do next.

## Solution

**passwordStrength.css**

```css
.weak { color: #ba0517; }
.medium { color: #a96404; }
.strong { color: #2e844a; }
```

**passwordStrength.html**

```html
<template>
    <input class="password" type="password" oninput={handleInput} />
    <template lwc:if={hasValue}>
        <p class={strengthClass}>{label}</p>
        <ul>
            <template for:each={missing} for:item="rule">
                <li key={rule.label} class="rule">{rule.label}</li>
            </template>
        </ul>
    </template>
</template>
```

**passwordStrength.js**

```javascript
import { LightningElement } from "lwc";

export default class PasswordStrength extends LightningElement {
    value = "";

    handleInput(event) {
        this.value = event.target.value;
    }

    get hasValue() {
        return this.value.length > 0;
    }

    get rules() {
        const v = this.value;
        return [
            { label: "At least 8 characters", met: v.length >= 8 },
            { label: "Upper and lower case letters", met: /[a-z]/.test(v) && /[A-Z]/.test(v) },
            { label: "A number", met: /\d/.test(v) },
            { label: "A symbol", met: /[^A-Za-z0-9]/.test(v) },
        ];
    }

    get score() {
        return this.rules.filter((r) => r.met).length;
    }

    get label() {
        if (this.score === 4) return "Strong";
        return this.score >= 2 ? "Medium" : "Weak";
    }

    get strengthClass() {
        return `strength ${this.label.toLowerCase()}`;
    }

    get missing() {
        return this.rules.filter((r) => !r.met);
    }
}
```
