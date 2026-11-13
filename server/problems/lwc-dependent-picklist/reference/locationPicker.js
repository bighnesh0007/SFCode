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
