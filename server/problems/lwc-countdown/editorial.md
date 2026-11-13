## Approach

The state is the seconds left and whether an interval is running (the interval id). Everything shown is derived from those two.

- `setInterval` returns an id; keep it so pause, reset, finishing and `disconnectedCallback` can all `clearInterval` it. A forgotten interval keeps ticking after the component is gone.
- Disabling Start while running prevents a second interval that would make the clock run twice as fast.
- `padStart(2, "0")` gives `0:09` rather than `0:9`.
- On Salesforce, the `@lwc/lwc/no-async-operation` lint rule asks you to justify the interval; a timer is exactly the case for it.

## Solution

**countdownTimer.css**

```css
.time { font-size: 2rem; font-variant-numeric: tabular-nums; }
```

**countdownTimer.html**

```html
<template>
    <p class="time">{display}</p>
    <button class="start" disabled={running} onclick={start}>Start</button>
    <button class="pause" disabled={notRunning} onclick={pause}>Pause</button>
    <button class="reset" onclick={reset}>Reset</button>
</template>
```

**countdownTimer.js**

```javascript
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
```
