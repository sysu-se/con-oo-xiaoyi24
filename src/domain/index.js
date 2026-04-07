export class Sudoku {
  constructor(grid) {
    // 进行深拷贝，避免外部修改传入的原数组或共享引用污染
    this.grid = JSON.parse(JSON.stringify(grid));
  }

  getGrid() {
    // 返回自身的深拷贝，防止外部直接被篡改
    return JSON.parse(JSON.stringify(this.grid));
  }

  guess({ row, col, value }) {
    // 处理非法输入或者越界问题
    if (row < 0 || row > 8 || col < 0 || col > 8) return;
    this.grid[row][col] = value;
  }

  clone() {
    // 提供实例的深拷贝，用于 Undo/Redo 历史快照
    return new Sudoku(this.getGrid());
  }

  toJSON() {
    return {
      grid: this.getGrid()
    };
  }

  toString() {
    let res = [];
    const separator = '+-------+-------+-------+';
    for (let r = 0; r < 9; r++) {
      if (r % 3 === 0) res.push(separator);
      let rowStr = '| ';
      for (let c = 0; c < 9; c++) {
        const val = this.grid[r][c];
        rowStr += (val === 0 || val === null ? '.' : val) + ' ';
        if ((c + 1) % 3 === 0) rowStr += '|';
      }
      res.push(rowStr);
    }
    res.push(separator);
    return res.join('\n');
  }
}

export class Game {
  constructor({ sudoku, history = [], future = [] }) {
    this.sudoku = sudoku;
    this.history = history; // 存放过去的快照 (Sudoku 实例)
    this.future = future;   // 存放被撤销的快照 (Sudoku 实例)，用于重做
  }

  getSudoku() {
    return this.sudoku;
  }

  guess(move) {
    // 每次发生新动作前，把当前的局面拍下快照存进 history
    this.history.push(this.sudoku.clone());
    // 发生新的 guess 后，原本的重做历史就失效了
    this.future = [];
    
    this.sudoku.guess(move);
  }

  canUndo() {
    return this.history.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  undo() {
    if (!this.canUndo()) return;
    // 1. 把当前局面推倒 future 里用于 redo
    this.future.push(this.sudoku.clone());
    // 2. 从 history 中取出最近的一次打底状态，作为当前局面
    this.sudoku = this.history.pop();
  }

  redo() {
    if (!this.canRedo()) return;
    // 1. 同理，重做前把当前局面存入 history
    this.history.push(this.sudoku.clone());
    // 2. 将 future 里缓存的下一步拿出来作为当前局面
    this.sudoku = this.future.pop();
  }

  toJSON() {
    return {
      sudoku: this.sudoku.toJSON(),
      history: this.history.map(s => s.toJSON()),
      future: this.future.map(s => s.toJSON())
    };
  }
}

// === 统一导出必须存在的工厂 API，供单元测试和 UI 使用 ===

export function createSudoku(input) {
  return new Sudoku(input);
}

export function createSudokuFromJSON(json) {
  return new Sudoku(json.grid);
}

export function createGame({ sudoku }) {
  return new Game({ sudoku });
}

export function createGameFromJSON(json) {
  const sudoku = createSudokuFromJSON(json.sudoku);
  const history = json.history.map(sJson => createSudokuFromJSON(sJson));
  const future = json.future.map(sJson => createSudokuFromJSON(sJson));
  
  return new Game({ sudoku, history, future });
}
