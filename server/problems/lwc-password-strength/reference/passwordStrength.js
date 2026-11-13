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
