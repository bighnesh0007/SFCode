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
