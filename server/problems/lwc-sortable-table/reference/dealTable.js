import { LightningElement, api } from "lwc";

export default class DealTable extends LightningElement {
    @api rows = [];
    @api pageSize = 5;
    sortField = null;
    sortDir = 1;
    page = 1;

    get sorted() {
        const rows = [...(this.rows || [])];
        if (!this.sortField) return rows;
        const field = this.sortField;
        const compare = field === "name" ? (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : (a, b) => a.amount - b.amount;
        return rows.sort((a, b) => compare(a, b) * this.sortDir);
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.sorted.length / this.pageSize));
    }

    get visibleRows() {
        const start = (this.page - 1) * this.pageSize;
        return this.sorted.slice(start, start + this.pageSize);
    }

    get isFirst() {
        return this.page <= 1;
    }

    get isLast() {
        return this.page >= this.totalPages;
    }

    handleSort(event) {
        const field = event.currentTarget.dataset.field;
        this.sortDir = field === this.sortField ? -this.sortDir : 1;
        this.sortField = field;
        this.page = 1;
    }

    handlePrev() {
        if (!this.isFirst) this.page -= 1;
    }

    handleNext() {
        if (!this.isLast) this.page += 1;
    }
}
