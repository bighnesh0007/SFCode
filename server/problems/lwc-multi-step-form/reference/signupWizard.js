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
