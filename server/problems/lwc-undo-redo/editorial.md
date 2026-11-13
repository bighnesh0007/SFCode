## Approach

Undo is easy when state is **immutable**: each change produces a new array, so the history is simply a stack of previous arrays.

- `past` holds earlier versions, `future` holds undone ones. Undo moves the current version onto `future` and takes the top of `past`; redo does the reverse.
- Any new change after an undo clears `future`, because the redo history no longer follows from the current state.
- Notes need stable keys. Using the text or the index as the key breaks when two notes match or one is removed.
- The keyboard shortcut listens on a wrapper (`tabindex="0"` so it can take focus); `preventDefault()` stops the browser's own undo in the input.

## Solution

**undoList.css**

```css
.note { display: flex; gap: 0.5rem; }
```

**undoList.html**

```html
<template>
    <div class="wrapper" tabindex="0" onkeydown={handleKey}>
        <input class="new" value={draft} oninput={handleInput} />
        <button class="add" onclick={add}>Add</button>
        <button class="undo" disabled={cannotUndo} onclick={undo}>Undo</button>
        <button class="redo" disabled={cannotRedo} onclick={redo}>Redo</button>
        <ul>
            <template for:each={notes} for:item="note">
                <li key={note.id} class="note">
                    <span class="label">{note.text}</span>
                    <button class="remove" data-id={note.id} onclick={remove}>Remove</button>
                </li>
            </template>
        </ul>
    </div>
</template>
```

**undoList.js**

```javascript
import { LightningElement } from "lwc";

export default class UndoList extends LightningElement {
    notes = [];
    past = [];
    future = [];
    draft = "";
    nextId = 1;

    get cannotUndo() {
        return this.past.length === 0;
    }

    get cannotRedo() {
        return this.future.length === 0;
    }

    handleInput(event) {
        this.draft = event.target.value;
    }

    commit(next) {
        this.past = [...this.past, this.notes];
        this.notes = next;
        this.future = [];
    }

    add() {
        const text = this.draft.trim();
        if (!text) return;
        this.commit([...this.notes, { id: this.nextId++, text }]);
        this.draft = "";
    }

    remove(event) {
        const id = Number(event.currentTarget.dataset.id);
        this.commit(this.notes.filter((n) => n.id !== id));
    }

    undo() {
        if (this.cannotUndo) return;
        this.future = [this.notes, ...this.future];
        this.notes = this.past[this.past.length - 1];
        this.past = this.past.slice(0, -1);
    }

    redo() {
        if (this.cannotRedo) return;
        this.past = [...this.past, this.notes];
        this.notes = this.future[0];
        this.future = this.future.slice(1);
    }

    handleKey(event) {
        if (!event.ctrlKey) return;
        const key = event.key.toLowerCase();
        if (key === "z") {
            event.preventDefault();
            this.undo();
        } else if (key === "y") {
            event.preventDefault();
            this.redo();
        }
    }
}
```
