# 面向对象重构设计文档

## 1. `Sudoku` 与 `Game` 的职责边界

* **`Sudoku` (数独盘面类)**：
  * **职责**：维护单一时刻的 9x9 数独盘面状态。
  * **行为**：处理具体的落子校验（如越界检查）、落子更新（`guess`），并负责自身的深拷贝（`clone`）、序列化（`toJSON`）和格式化输出（`toString`）。
  * **边界**：它是一个纯粹表示“状态”的数据实体，不知道什么是撤销/重做，也没有时间线的概念。

* **`Game` (游戏控制类)**：
  * **职责**：管理整局游戏的生命周期与历史状态。
  * **行为**：维护当前运行的 `Sudoku` 实例，管理历史操作栈（`history`）和撤销操作栈（`future`）。提供 `undo()` 和 `redo()` 功能。
  * **边界**：它是 `Sudoku` 的上层调用者（协调者），负责状态的流转和历史快照的存储，但绝不直接干涉九宫格内部的具体数字逻辑。

## 2. `Move` 是值对象还是实体对象？为什么？

**`Move` 是值对象 (Value Object)。**
* **原因**：在本项目中，`Move`（即 `guess` 函数接收的 `{ row, col, value }` 参数）仅用于承载落子动作的数据载体，没有唯一标识符（Identity），也不包含任何行为（Methods）。两个包含相同行列和数值的 `Move` 在逻辑上是完全等价的，因此它是标准的值对象。

## 3. History 中存储的是什么？为什么？

**`history` (以及 `future`) 中存储的是 `Sudoku` 对象的完整深拷贝快照。**
* **存储内容**：每一次有效 `guess` 之前，当前 `Sudoku` 实例的深度克隆副本。
* **为什么**（采用**备忘录模式/快照模式**）：
  1. **复杂性低，健壮性高**：数独的撤销无需反向计算（不使用命令模式），直接替换盘面状态可以绝对保证数据的正确性。
  2. **完美配合序列化**：整个历史栈都是独立的对象的快照，可以直接随游戏主体一起被序列化为 JSON，不会出现引用的混乱或状态纠缠。

## 4. 复制策略是什么？哪些地方需要深拷贝？

本项目的核心复制策略是**彻底的深拷贝 (Deep Copy)**，主要在以下三个场景严格执行：
1. **初始化构造**：在 `new Sudoku(grid)` 时，通过 `JSON.parse(JSON.stringify(grid))` 将外部传入的二维数组与内部状态隔离，防止外部意外修改。
2. **状态暴露**：通过 `getGrid()` 返回盘面时，再次深度克隆二维数组，确保内部核心数据的封装性，防止调用方修改返回值。
3. **保存历史快照**：在 `Game.guess` 和 `undo`/`redo` 时，调用 `sudoku.clone()` 获取深拷贝对象压入栈中，防止不同历史版本的快照发生引用的地址共享。
* **避免浅拷贝的原因**：二维数组内部嵌套了数组，浅拷贝（如 `[...grid]`）只能拷贝第一层，改动里层元素仍会污染全部历史记录。

## 5. 序列化 / 反序列化设计

* **序列化 (Serialization / `toJSON`)**：
  在 `Sudoku` 和 `Game` 中分别实现定制的 `toJSON()` 方法。调用 `game.toJSON()` 时，会自动级联调用并转换为纯数据对象，最终通过 `JSON.stringify` 变为 JSON 字符串。
* **反序列化 (Deserialization / 工厂函数)**：
  因为反序列化后的 JSON 解析对象 (`JSON.parse`) 丢失了类的方法，我们通过顶层暴露的**工厂函数**（`createGameFromJSON` 和 `createSudokuFromJSON`）重新组装。将 JSON 数据中的静态数组重新包装成 `new Sudoku` 实例，恢复其内部行为。

## 6. 外表化接口的设计与原因

* **接口**：通过重写对象的 `toString()` 方法来实现。
* **设计原因**：默认的 `toString()` 只会输出 `[object Object]`。重写 `Sudoku.prototype.toString()` 能将其转化为自带坐标边界符的 ASCII 字符矩阵（如加边框的 9x9 宫格）。
* **用途**：实现了对象的状态可视化，为开发者在控制台直接打印 `console.log(sudoku)` 提供直观、美观的调试信息。

## 7. 附加分项 (Bonus) 说明

我完美完成了两项加分项：
1. **增强的调试表示 (`toString` 优化)**：
   在 `Sudoku` 的 `toString` 中引入了 `+-------+-------+-------+` 这样的 ASCII 表格框线，直观区分了 3x3 的九宫格区域。
2. **支持完整的对象往返测试 (Round-trip Test)**：
   新增了单元测试文件 `tests/hw1/06-round-trip.test.js`。该测试验证了链路： `产生操作的Game实例 -> 使用 toJSON 序列化 -> 导出为 JSON 字符串 -> 利用工厂函数反序列化 -> 恢复为全新 Game 实例 -> 测试新实例的恢复与方法调用能力`，证明了序列化链路的数据无损与行为完整。

---

# HW1.1 新增改进

## 8. HW1.1 改进说明

相比 HW1，本次做了三项实质性改进：

**改进 1：`Sudoku` 增加 `given` / `cells` 区分**

HW1 只有 `this.grid` 一份数据，无法区分"题目固定格"和"玩家填写格"，导致 `guess()` 可以覆盖题目数字，序列化后也无法还原固定格信息。

改进后，构造函数接受 `given`（题目原始格局，永不改变）和 `cells`（当前状态，可变）两份数据。`guess()` 先检查 `isGiven(row, col)`，固定格直接返回 `false` 拒绝修改。领域对象现在主动执行数独的业务规则。

**改进 2：`getSudoku()` 改为返回 `clone()`**

HW1 的 `getSudoku()` 返回 `this.sudoku` 本身，外部代码可以绕过 `Game` 直接调用 `game.getSudoku().guess(move)`，完全跳过 `history` 记录，破坏撤销/重做的一致性。

改进后 `getSudoku()` 返回 `this.sudoku.clone()`，外部拿到的是临时副本，修改它对 `Game` 内部没有任何影响。同时新增 `game.getGrid()` 和 `game.getGiven()`，让 UI 可以直接从 `Game` 拿数据，不再需要经过 `getSudoku()`。

**改进 3：深拷贝改为 `map + 展开`**

HW1 使用 `JSON.parse(JSON.stringify(grid))` 深拷贝，隐含假设数据必须是可 JSON 序列化的结构。改为 `grid.map(row => [...row])`，语义更直接，对二维数字数组是严格的深拷贝，不依赖 JSON 能力。

**改进 4：校验逻辑（invalidCells）内聚到领域对象**

HW1 的冲突检测逻辑散落在 `stores/grid.js` 的 derived store 里——校验是 View 层自己算的，领域对象对"哪些格子冲突"一无所知。这违反了"领域对象提供校验能力"的职责要求。

改进后，`Sudoku` 增加 `getInvalidCells()` 方法，完整封装行 / 列 / 宫冲突检测逻辑；`Game.getInvalidCells()` 委托给 `this.sudoku.getInvalidCells()`；`gameStore.sync()` 将结果打包进快照，`invalidCells` derived store 只做简单透传。职责边界更清晰，删掉 `stores/grid.js` 里的检测代码后，领域层的校验能力依然完整。

**为什么 HW1 不足以支撑真实接入**

HW1 中 `grid.js` 同时维护 `domainGame`（领域对象）和 `userGrid`（Svelte writable store）两份独立状态，每次操作后靠 `syncUI()` 手动把数据从领域对象抄进 store。Svelte 订阅的是 `userGrid`，领域对象只是中间的"计算工具"。把 `domainGame` 删掉、直接操作 `userGrid`，界面照常工作——这说明领域对象没有不可或缺地嵌入游戏流程。

---

## 9. 领域对象如何被 View 层消费

**View 层直接消费的是 `gameStore`（Store Adapter，适配层）。**

组件不直接持有 `Game` 或 `Sudoku` 实例，只和 `gameStore` 打交道。

### View 层拿到的数据

`gameStore` 是一个可订阅对象，订阅到的值是一个纯数据快照：

```js
{
  grid:         number[][], // 当前棋盘（所有格子的当前数字）
  given:        number[][], // 题目固定格（非零 = 固定，不可编辑）
  canUndo:      boolean,
  canRedo:      boolean,
  invalidCells: string[],  // 冲突格子坐标列表，格式 ["x,y", ...]，由 Sudoku.getInvalidCells() 计算
}
```

`invalidCells` 同样由领域对象 `Sudoku.getInvalidCells()` 计算后经 `sync()` 打包进快照，对外通过 `derived(gameStore, $gs => $gs.invalidCells)` 暴露为独立 store，供组件订阅。校验逻辑完全内聚在领域层，Store 层只做透传，不重复实现。

### 用户操作如何进入领域对象

```
用户按键盘数字
  → Keyboard.svelte 调用 gameStore.guess($cursor, num)
      → 内部调用 game.guess({ row, col, value })
          → game 记录快照到 history
          → sudoku.cells[row][col] = value
      → sync() 把 game 最新状态整体打包写入 writable
          → Svelte 检测到新值，重渲染界面

用户点 Undo 按钮
  → Actions.svelte 调用 gameStore.undo()
      → 内部调用 game.undo()
      → sync() → Svelte 刷新
```

---

## 10. 响应式机制说明

### 依赖的机制：`writable` store + `subscribe`

Svelte 的规则是：任何对象，只要有 `subscribe(fn)` 方法，组件就可以用 `$` 前缀订阅它。`writable` 内置了这套接口。

`gameStore` 把 Svelte 的 `writable` 包在内部，对外暴露 `subscribe`，同时暴露 `guess / undo / redo` 等操作方法：

```js
function createGameStore() {
  const { subscribe, set } = writable({ grid: ..., given: ..., canUndo: false, canRedo: false, invalidCells: [] });
  let game = null;

  function sync() {
    set({                        // ← 调用 set() 才会通知 Svelte
      grid:         game.getGrid(),
      given:        game.getGiven(),
      canUndo:      game.canUndo(),
      canRedo:      game.canRedo(),
      invalidCells: game.getInvalidCells(), // ← 校验逻辑在 Sudoku 中，这里只做透传
    });
  }

  return {
    subscribe,                   // ← 组件通过这个订阅
    guess(pos, value) { game.guess(...); sync(); },
    undo() { game.undo(); sync(); },
    redo() { game.redo(); sync(); },
  };
}
```

### 为什么 UI 会更新

每次操作执行完后调用 `sync()`，它调用 `set()` 把一个**全新的对象**写入 writable。Svelte 检测到引用变化，通知所有用了 `$gameStore` 的组件重新渲染。

关键在于——每次 `set()` 传入的是全新对象（`game.getGrid()` 返回的是深拷贝）。Svelte 用引用比较判断是否需要更新，新对象 !== 旧对象，必定触发更新。

### 如果直接 mutate 对象，会出什么问题

```js
// 错误：直接改 game 内部字段
game.sudoku.cells[0][0] = 5;
```

Svelte 完全感知不到这个赋值。writable 里存的对象引用没变，Svelte 不会触发重渲染，界面停留在上一次 `sync()` 的结果，和实际数据不一致，出现"数据变了但界面不刷新"的 bug。

```js
// 同样错误：拿到 grid 后直接改数组元素
const g = $gameStore.grid;
g[0][0] = 5;  // 只改了本地变量，store 里的值没有调用 set()，界面不更新
```

这就是为什么必须通过 `gameStore.guess()` → `sync()` → `set()` 这条路径，而不能直接 mutate。

### 各层数据的可见性

| 数据 | 对 UI 可见？ | 说明 |
|---|---|---|
| `$gameStore.grid` | ✅ | 渲染棋盘格数字 |
| `$gameStore.given` | ✅ | 判断格子是否可编辑 |
| `$gameStore.canUndo/canRedo` | ✅ | 按钮 disabled 状态 |
| `$gameStore.invalidCells` | ✅（快照字段）| 由 `Sudoku.getInvalidCells()` 计算，经 `sync()` 打包，再经 `derived` 透传给组件 |
| `$invalidCells` | ✅（derived） | 标记冲突格变红 |
| `game.history` | ❌ | 历史快照数组，UI 不需要知道 |
| `game.future` | ❌ | 重做快照数组 |
| `sudoku.cells` 内部引用 | ❌ | UI 拿到的永远是深拷贝 |
