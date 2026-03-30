class HashGrid {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.grid = new Map();
    this._initGrid();
  }

  _initGrid() {
    const yLen = this.height / this.cellSize;
    const xLen = this.width / this.cellSize;
    for (let y = 0; y < yLen; y++) {
      for (let x = 0; x < xLen; x++) {
        this.grid.set(
          this.getKey(x * this.cellSize, y * this.cellSize),
          new Set()
        );
      }
    }
  }

  getIndex(value) {
    return (value / this.cellSize) | 0;
  }

  getKey(x, y) {
    return this._getKeyByIndices(this.getIndex(x), this.getIndex(y));
  }

  _getKeyByIndices(xi, yi) {
    return xi + "." + yi;
  }

  addItem(item) {
    const key = this.getKey(item.x, item.y);
    if (!this.grid.has(key)) {
      const cell = new Set().add(item);
      this.grid.set(key, cell);
      return cell;
    }
    return this.grid.get(key).add(item);
  }

  removeItem(item) {
    const key = this.getKey(item.x, item.y);
    if (!this.grid.has(key)) return;
    this.grid.get(key).delete(item);
  }

  query(x, y, radius) {
    const xi0 = this.getIndex(x - radius) - 1;
    const xi1 = this.getIndex(x + radius) + 1;
    const yi0 = this.getIndex(y - radius) - 1;
    const yi1 = this.getIndex(y + radius) + 1;
    let result = new Set();
    let key;
    for (let xi = xi0; xi <= xi1; xi++) {
      for (let yi = yi0; yi <= yi1; yi++) {
        key = this._getKeyByIndices(xi, yi);
        if (this.grid.has(key)) {
          this.grid.get(key).forEach(result.add, result);
        }
      }
    }

    return result;
  }

  createClient(item) {
    return new HashGridClient(this, item);
  }
}

class HashGridClient {
  constructor(hashGrid, item) {
    this.hashGrid = hashGrid;
    this.item = item;
    this.indexX = this.hashGrid.getIndex(item.x);
    this.indexY = this.hashGrid.getIndex(item.y);
    this.cell = this.hashGrid.addItem(item);
  }

  update() {
    const newIndexX = this.hashGrid.getIndex(this.item.x);
    const newIndexY = this.hashGrid.getIndex(this.item.x);
    if (newIndexX === this.indexX && newIndexY === this.indexY) return;

    this.cell.delete(this.item);
    this.cell = this.hashGrid.addItem(this.item);
    this.indexX = newIndexX;
    this.indexY = newIndexY;
  }

  delete() {
    this.cell.delete(this.item);
  }
}
