## Approach

- **State:** an array of `{ id, text, done }`. The `id` gives `for:each` a stable `key`; using the text as a key breaks when two items match.
- **Immutable updates:** create new arrays with spread, `filter` and `map`. Reassigning a field always re-renders, and there's no need for `@track`.
- **Which item was clicked?** `data-id` on the element, read from `event.currentTarget.dataset` (as a string, so convert it with `Number`).
- **Seeding:** `items` is an `@api` getter/setter pair, so a parent can pass plain strings while the component keeps richer objects inside.

## Solution

**todoList.html**

```html
<template>
    <input class="new-item" />
    <button class="add" onclick={add}>Add</button>
    <ul>
        <template for:each={rows} for:item="row">
            <li key={row.id} class={row.className}>
                <span class="text" data-id={row.id} onclick={toggle}>{row.text}</span>
                <button class="remove" data-id={row.id} onclick={remove}>×</button>
            </li>
        </template>
    </ul>
    <p class="summary">{doneCount} of {todos.length} done</p>
</template>
```

**todoList.js**

```javascript
import { LightningElement, api } from "lwc";

let nextId = 1;

export default class TodoList extends LightningElement {
    todos = [];

    @api
    get items() {
        return this.todos.map((t) => t.text);
    }
    set items(value) {
        this.todos = (value || []).map((text) => ({ id: nextId++, text, done: false }));
    }

    get rows() {
        return this.todos.map((t) => ({ ...t, className: t.done ? "item done" : "item" }));
    }

    get doneCount() {
        return this.todos.filter((t) => t.done).length;
    }

    add() {
        const input = this.template.querySelector(".new-item");
        const text = input.value.trim();
        if (text) {
            this.todos = [...this.todos, { id: nextId++, text, done: false }];
        }
        input.value = "";
    }

    toggle(event) {
        const id = Number(event.currentTarget.dataset.id);
        this.todos = this.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    }

    remove(event) {
        const id = Number(event.currentTarget.dataset.id);
        this.todos = this.todos.filter((t) => t.id !== id);
    }
}
```

**todoList.css**

```css
.done .text { text-decoration: line-through; color: #888; }
```
