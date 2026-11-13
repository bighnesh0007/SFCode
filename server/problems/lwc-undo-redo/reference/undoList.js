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
