## Approach

Hold only **state** in fields (`sortField`, `sortDir`, `page`) and derive everything the template shows in **getters**. Then sorting, paging and a parent swapping `rows` can never leave the view inconsistent.

- **Never sort `this.rows` in place.** It belongs to the parent, and in Salesforce it's frozen: `sort()` on it throws. Copy first with `[...this.rows]`.
- `Array.prototype.sort` is **stable** (guaranteed since ES2019), so ties keep their input order without extra work.
- Clicking the active column flips direction; a new column starts ascending. Either way the page resets to 1, because page 3 of the old order means nothing in the new one.
- Templates can't evaluate `page === 1`, so `isFirst` and `isLast` getters feed the buttons' `disabled` attributes.

## Solution

**dealTable.css**

```css
table { border-collapse: collapse; width: 100%; }
td, th { padding: 0.25rem 0.5rem; text-align: left; }
.amount { text-align: right; }
```

**dealTable.html**

```html
<template>
    <table>
        <thead>
            <tr>
                <th><button class="sort" data-field="name" onclick={handleSort}>Name</button></th>
                <th><button class="sort" data-field="amount" onclick={handleSort}>Amount</button></th>
            </tr>
        </thead>
        <tbody>
            <template for:each={visibleRows} for:item="row">
                <tr key={row.id} class="row">
                    <td class="name">{row.name}</td>
                    <td class="amount">{row.amount}</td>
                </tr>
            </template>
        </tbody>
    </table>
    <button class="prev" disabled={isFirst} onclick={handlePrev}>Prev</button>
    <p class="page">Page {page} of {totalPages}</p>
    <button class="next" disabled={isLast} onclick={handleNext}>Next</button>
</template>
```

**dealTable.js**

```javascript
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
```
