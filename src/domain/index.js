// 深拷贝二维数组：比 JSON.parse/stringify 更直接，不依赖 JSON 兼容性假设
function deepCopy2D(grid) {
  return grid.map(row => [...row]);
}

export class Sudoku {
  // given:  原始题目棋盘（哪个格子有数字 = 固定格，永不改变）
  // cells:  当前棋盘状态（题目格 + 玩家所填，undo/redo 改的是这里）
  // 如果只传 given，cells 默认和 given 一样（游戏刚开始）
  constructor(given, cells = null) {
    this.given = deepCopy2D(given);
    this.cells = cells !== null ? deepCopy2D(cells) : deepCopy2D(given);
  }

  // 判断某格是否为题目固定格（不允许玩家修改）
  isGiven(row, col) {
    return this.given[row][col] !== 0;
  }

  getGrid() {
    // 返回当前棋盘（cells）的深拷贝，防止外部篡改内部状态
    return deepCopy2D(this.cells);
  }

  getGiven() {
    // 返回原始题目棋盘的深拷贝，供 UI 区分哪些格可编辑
    return deepCopy2D(this.given);
  }

  guess({ row, col, value }) {
    if (row < 0 || row > 8 || col < 0 || col > 8) return false;
    if (this.isGiven(row, col)) return false; // 题目固定格拒绝修改
    if (value < 0 || value > 9) return false; // 合法范围：0 = 清空，1-9 = 填数
    this.cells[row][col] = value;
    return true;
  }

  clone() {
    // clone 必须同时保留 given 和 cells，否则快照会丢失"哪些是题目格"的信息
    return new Sudoku(this.given, this.cells);
  }

  // 返回当前盘面中所有冲突格子的坐标列表，格式为 ["x,y", ...]（x=列, y=行）
  // 校验逻辑内聚在领域对象，不应散落在 Store 或 View 层
  getInvalidCells() {
    const SIZE = 9;
    const BOX = 3;
    const invalid = [];

    const addInvalid = (x, y) => {
      const key = x + ',' + y;
      if (!invalid.includes(key)) invalid.push(key);
    };

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const value = this.cells[y][x];
        if (!value) continue;

        // 同行 / 同列冲突
        for (let i = 0; i < SIZE; i++) {
          if (i !== x && this.cells[y][i] === value) addInvalid(x, y);
          if (i !== y && this.cells[i][x] === value) addInvalid(x, i);
        }

        // 同宫（3×3）冲突
        const startY = Math.floor(y / BOX) * BOX;
        const startX = Math.floor(x / BOX) * BOX;
        for (let r = startY; r < startY + BOX; r++) {
          for (let c = startX; c < startX + BOX; c++) {
            if (r !== y && c !== x && this.cells[r][c] === value) {
              addInvalid(c, r);
            }
          }
        }
      }
    }

    return invalid;
  }

  toJSON() {
    return {
      given: deepCopy2D(this.given),
      cells: deepCopy2D(this.cells),
    };
  }

  toString() {
    let res = [];
    const separator = '+-------+-------+-------+';
    for (let r = 0; r < 9; r++) {
      if (r % 3 === 0) res.push(separator);
      let rowStr = '| ';
      for (let c = 0; c < 9; c++) {
        const val = this.cells[r][c];
        rowStr += (val === 0 || val === null ? '.' : val) + ' ';
        if ((c + 1) % 3 === 0) rowStr += '| ';
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

  // 返回当前盘面的只读快照（clone），外部无法通过它绕过 Game 的历史管理
  getSudoku() {
    return this.sudoku.clone();
  }

  // UI 直接拿当前 cells（玩家当前棋盘）
  getGrid() {
    return this.sudoku.getGrid();
  }

  // UI 直接拿题目固定格，用于区分哪些格子不可编辑
  getGiven() {
    return this.sudoku.getGiven();
  }

  // 委托给 Sudoku，让 gameStore 可以直接从 Game 一次性取出所有 UI 所需数据
  getInvalidCells() {
    return this.sudoku.getInvalidCells();
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

export function createSudoku(given) {
  // given = 原始题目棋盘（非零 = 固定格）
  return new Sudoku(given);
}

export function createSudokuFromJSON(json) {
  // 新格式：{ given, cells }
  if (json.given !== undefined && json.cells !== undefined) {
    return new Sudoku(json.given, json.cells);
  }
  // 旧格式兼容：{ grid }（把 grid 同时当作 given 和 cells，无法区分固定格）
  return new Sudoku(json.grid, json.grid);
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
