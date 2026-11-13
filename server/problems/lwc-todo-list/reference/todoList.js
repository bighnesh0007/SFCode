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
