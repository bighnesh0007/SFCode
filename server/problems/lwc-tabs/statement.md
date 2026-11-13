Build a tab strip.

- A public property `tabs`: an array of `{ label, content }`.
- Render each tab as `<button class="tab" role="tab">` with its label, inside
  a `<div role="tablist">`. The **first** tab is selected initially.
- The selected tab has `aria-selected="true"` and the class `active`. The others
  have `aria-selected="false"`.
- Below the strip, `<div class="panel" role="tabpanel">` shows the selected tab's `content`.
- Clicking a tab selects it.
- **Keyboard:** with focus on the tab strip, `ArrowRight` selects the next tab and
  `ArrowLeft` the previous one, **wrapping around** at either end.
- If `tabs` is empty, render no panel.
