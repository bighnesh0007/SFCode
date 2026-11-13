## Approach

A wizard is a **state machine** with one piece of state that matters, `step`, plus the data collected so far. Everything else is derived.

- `lwc:if={isStep1}` and friends render exactly one step at a time. Getters exist because templates can't evaluate `step === 1`.
- Elements inside an `lwc:if` are **destroyed** when hidden. Values survive only because they live in component fields (`name`, `email`) and each input is bound with `value={name}`, so a re-created input starts with the saved text. Reading the input from the DOM later would fail: it's gone.
- Validation happens on **Next**, not on every keystroke, so users aren't scolded mid-typing. The error is cleared when the step passes and when going back.
- Trim once, when building the event detail, so `"  Ada "` is submitted as `"Ada"`.

## Solution

**signupWizard.css**

```css
.error { color: #ba0517; }
```

**signupWizard.html**

```html
<template>
    <p class="step">Step {step} of 3</p>
    <template lwc:if={isStep1}>
        <label>Name <input class="name" value={name} oninput={handleName} /></label>
    </template>
    <template lwc:if={isStep2}>
        <label>Email <input class="email" type="email" value={email} oninput={handleEmail} /></label>
    </template>
    <template lwc:if={isStep3}>
        <p class="review">Name: {trimmedName}, Email: {trimmedEmail}</p>
    </template>
    <template lwc:if={error}>
        <p class="error">{error}</p>
    </template>
    <template lwc:if={showBack}>
        <button class="back" onclick={handleBack}>Back</button>
    </template>
    <template lwc:if={isStep3}>
        <button class="submit" onclick={handleSubmit}>Submit</button>
    </template>
    <template lwc:else>
        <button class="next" onclick={handleNext}>Next</button>
    </template>
</template>
```

**signupWizard.js**

```javascript
import { LightningElement } from "lwc";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default class SignupWizard extends LightningElement {
    step = 1;
    name = "";
    email = "";
    error = "";

    get isStep1() {
        return this.step === 1;
    }

    get isStep2() {
        return this.step === 2;
    }

    get isStep3() {
        return this.step === 3;
    }

    get showBack() {
        return this.step > 1;
    }

    get trimmedName() {
        return this.name.trim();
    }

    get trimmedEmail() {
        return this.email.trim();
    }

    handleName(event) {
        this.name = event.target.value;
    }

    handleEmail(event) {
        this.email = event.target.value;
    }

    handleNext() {
        if (this.step === 1 && !this.trimmedName) {
            this.error = "Enter your name.";
            return;
        }
        if (this.step === 2 && !EMAIL.test(this.trimmedEmail)) {
            this.error = "Enter a valid email address.";
            return;
        }
        this.error = "";
        this.step += 1;
    }

    handleBack() {
        this.error = "";
        this.step -= 1;
    }

    handleSubmit() {
        this.dispatchEvent(new CustomEvent("submit", { detail: { name: this.trimmedName, email: this.trimmedEmail } }));
    }
}
```
