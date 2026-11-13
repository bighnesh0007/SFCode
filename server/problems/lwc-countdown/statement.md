Build a `c-countdown-timer`.

- **`@api seconds`**: where the countdown starts (default **60**).
- **`@api tickMs`**: how long one "second" lasts in milliseconds (default **1000**).
  It exists so tests and demos can run faster; use it for the interval.
- Show the time left in `<p class="time">` as `m:ss` (e.g. `1:05`, `0:09`).
- `<button class="start">` starts counting down one second at a time; it is
  `disabled` while running. `<button class="pause">` stops it; it is `disabled`
  while not running. `<button class="reset">` stops and goes back to `seconds`.
- At `0:00` the timer stops by itself and dispatches a **`done`** event, once.
- If the component is removed while running, the timer must stop.
