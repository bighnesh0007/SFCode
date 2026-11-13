import { LightningElement, api } from "lwc";

export default class CountdownTimer extends LightningElement {
    @api seconds = 60;
    @api tickMs = 1000;
    remaining;
    timer = null;

    connectedCallback() {
        this.remaining = this.seconds;
    }

    get display() {
        const n = this.remaining ?? this.seconds;
        return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
    }

    get running() {
        return this.timer !== null;
    }

    get notRunning() {
        return this.timer === null;
    }

    start() {
        if (this.timer !== null || this.remaining <= 0) return;
        // eslint-disable-next-line @lwc/lwc/no-async-operation -- a countdown needs a timer
        this.timer = setInterval(() => this.tick(), this.tickMs);
    }

    tick() {
        this.remaining -= 1;
        if (this.remaining <= 0) {
            this.remaining = 0;
            this.stop();
            this.dispatchEvent(new CustomEvent("done"));
        }
    }

    pause() {
        this.stop();
    }

    reset() {
        this.stop();
        this.remaining = this.seconds;
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }

    disconnectedCallback() {
        this.stop();
    }
}
