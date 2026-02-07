const db = {
  // existing stores

  expenses: {
    items: [],
    add(item) {
      this.items.push(item);
    },
    remove(item) {
      this.items = this.items.filter(i => i !== item);
    },
    getAll() {
      return this.items;
    }
  }
};

export default db;