# EVOLUTION.md — Homework 2 设计演进文档

## 1. 你如何实现提示功能？

提示功能分为两个层次，全部实现在领域对象中：

### 1.1 候选提示（`getCandidates`）

在 [`Sudoku`](src/domain/index.js:55) 中新增 `getCandidates(row, col)` 方法：

- 若目标格子已填数字，直接返回空数组 `[]`
- 若为空，遍历 1-9，排除同行、同列、同宫（3×3）中已出现的数字
- 返回剩余数字作为候选数集合（`number[]`）

实现细节：使用 `Set` 做差集运算，先 `new Set([1..9])`，然后 `delete` 掉冲突数字，最后 `[...set]` 展开返回。

### 1.2 下一步提示（`findNextMove`）

在 [`Sudoku`](src/domain/index.js:69) 中新增 `findNextMove()` 方法：

- 扫描全盘 81 格，对每个空格调用 `getCandidates(r, c)`
- 找到第一个候选数数量恰好为 1 的格子（即 Naked Single / 唯一候选数）
- 返回 `{ row, col, value }` 或 `null`（无可推定格子）

### 1.3 Game 层委托

[`Game`](src/domain/index.js:148) 中新增 `getCandidates(row, col)` 和 `findNextMove()` 两个委托方法，与 `getInvalidCells()` 保持一致的委托模式。

### 1.4 Store 层整合

[`gameStore.applyHint()`](src/node_modules/@sudoku/stores/grid.js:107) 改进为两级策略：

1. **优先**调用 `game.findNextMove()` — 若能找到 Naked Single，直接填入该推定数
2. **回退**调用 `solveSudoku()` 全盘求解 — 当没有 Naked Single 时，用外部求解器算出答案填入光标位置

返回值包含 `reason` 字段（`'naked_single'` 或 `'solver'`），为加分项"提示原因说明"提供数据基础。

---

## 2. 你认为提示功能更属于 `Sudoku` 还是 `Game`？为什么？

**提示的计算逻辑属于 `Sudoku`，对外接口通过 `Game` 暴露。**

理由：

- **`Sudoku`** 是唯一掌握盘面完整数据的对象。候选数计算（`getCandidates`）和 Naked Single 检测（`findNextMove`）是**纯盘面分析**——给定一个 9×9 数字矩阵，输出候选数或推定位置。这不依赖任何会话状态（history、undo/redo、explore），是 `Sudoku` 的天然职责。

- **`Game`** 作为协调层，负责对外暴露统一接口。UI 和 Store 层不应直接知道 `Sudoku` 的存在（封装原则），所以 `Game` 提供 `getCandidates()` / `findNextMove()` 委托方法。这与 HW1 中 `getInvalidCells()` 的委托模式完全一致。

- 类比：`Sudoku` 是"计算器"，`Game` 是"遥控器"。计算逻辑在计算器里，但用户按的是遥控器上的按钮。

---

## 3. 你如何实现探索模式？

探索模式采用 **"快照保存 + 线性子会话 + 失败记忆"** 方案。

### 3.1 状态建模

在 [`Game`](src/domain/index.js:108) 中新增三个字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `exploring` | `boolean` | 是否处于探索模式 |
| `exploreSnapshot` | `{ sudoku, history, future }` | 进入探索时的完整快照 |
| `failedSnapshots` | `Set<string>` | 已确认失败的盘面 key 集合 |

### 3.2 核心操作

- **`enterExplore()`**：保存当前 `sudoku` + `history` + `future` 的深拷贝快照，设置 `exploring = true`。不支持嵌套探索（已处于探索模式时返回 `false`）。

- **`commitExplore()`**：保留当前盘面和 history，清除 `exploring` 标记和快照。提交后的状态成为新的"主局面"。

- **`abandonExplore()`**：从 `exploreSnapshot` 恢复 `sudoku`、`history`、`future`，清除探索标记。效果等同于"从未进入过探索"。

- **`markExploreDeadEnd()`**：将当前 `cells` 的 JSON 序列化字符串加入 `failedSnapshots` Set。由 Store 层在检测到冲突时自动调用。

- **`isDeadEnd()`**：检查当前 `cells` 的序列化 key 是否在 `failedSnapshots` 中。

### 3.3 探索过程中的行为

- 探索过程**复用现有 history 栈**（线性），undo/redo 在探索中正常工作
- 每次 `guess` 后，Store 层检查 `invalidCells`：若有冲突且处于探索模式，自动调用 `markExploreDeadEnd()`
- 用户可以通过 undo 从死路回退，选择其他候选值继续探索

---

## 4. 主局面与探索局面的关系是什么？

### 4.1 关系模型：快照 + 分支

- **进入探索时**：主局面被"冻结"为快照（深拷贝），探索在一个**独立分支**上进行
- **探索过程中**：操作的是 `Game` 的当前 `sudoku` 实例（与主局面共享同一个 `Game` 对象，但 `sudoku` 是独立副本）
- **提交时**：探索分支的最终状态**成为新的主局面**（快照被丢弃，当前状态保留）
- **放弃时**：从快照**完整恢复**主局面（探索分支的所有修改被丢弃）

### 4.2 是共享对象还是复制对象？

**复制对象**。进入探索时，`exploreSnapshot` 保存的是 `sudoku.clone()` + `history.map(s => s.clone())` + `future.map(s => s.clone())` 的深拷贝。探索过程中的修改不会污染快照。

### 4.3 是否会产生深拷贝问题？

不会。HW1 已经建立了完善的深拷贝机制（`Sudoku.clone()` 使用 `map + 展开`），探索快照复用同一机制。数独盘面数据量极小（81 个整数），深拷贝的性能开销可忽略。

### 4.4 提交时如何合并？

提交时**不需要合并**。探索分支的最终状态直接成为主局面——`exploring = false`，`exploreSnapshot = null`，当前 `sudoku`/`history`/`future` 保持不变。这是一种"替换"语义而非"合并"语义。

### 4.5 放弃时如何回滚？

从 `exploreSnapshot` 中取出保存的 `sudoku`、`history`、`future`，逐一 `clone()` 后赋值回 `Game` 实例。效果等同于时光倒流到 `enterExplore()` 之前的瞬间。

---

## 5. 你的 history 结构在本次作业中是否发生了变化？

### 5.1 核心结构未变

`history` 和 `future` 仍然是**线性栈**（数组），存储 `Sudoku` 深拷贝快照。undo/redo 的栈操作逻辑（push/pop）完全不变。

### 5.2 语义层面的变化

探索模式引入了**逻辑上的分支**：

- 进入探索时，`exploreSnapshot` 保存了进入点的 history 栈状态
- 探索过程中的操作在 history 栈上正常累积
- 放弃时，history 栈被快照覆盖（相当于分支被剪枝）
- 提交时，history 栈保留（分支成为主干）

这可以理解为在**线性栈之上叠加了一层"检查点/回滚点"机制**，而非真正引入树状数据结构。

### 5.3 是否引入了树状分支？

**没有在数据结构层面引入树状分支。** `history` 仍然是 `Sudoku[]`。分支语义通过 `exploreSnapshot` 的保存/恢复来实现，这是一种更轻量的设计——避免了 DAG 合并的复杂性，同时满足了作业要求的"回溯"和"记忆"功能。

---

## 6. Homework 1 中的哪些设计，在 Homework 2 中暴露出了局限？

### 6.1 `Game` 缺乏"模式/状态"概念

HW1 的 `Game` 只有一个隐式状态："正常游戏"。探索模式要求 `Game` 能区分"正常模式"和"探索模式"，且两种模式下 `guess` 的语义不同（探索模式需要死路检测）。HW1 的设计没有为此预留扩展点。

**应对**：新增 `exploring` 布尔字段和配套方法，`guess` 本身不变，死路检测在 Store 层做（保持 `Game.guess` 的纯粹性）。

### 6.2 `Sudoku` 缺乏盘面分析能力

HW1 的 `Sudoku` 只有 `guess`/`clone`/`getInvalidCells`，没有候选数计算和推定数检测。提示功能需要这些分析能力。

**应对**：新增 `getCandidates()` 和 `findNextMove()` 方法。这些方法自然地属于 `Sudoku` 的职责范围，不需要修改现有接口。

### 6.3 序列化未考虑"模式状态"

HW1 的 `toJSON()` 只序列化 `sudoku` + `history` + `future`。探索模式需要额外序列化 `exploring`、`exploreSnapshot`、`failedSnapshots`。

**应对**：扩展 `Game.toJSON()` 和 `createGameFromJSON()`，增加新字段的序列化/反序列化。向后兼容：旧格式 JSON（无 explore 字段）反序列化时默认为非探索模式。

### 6.4 深拷贝机制需要覆盖更多对象

HW1 的深拷贝只覆盖 `Sudoku`。探索快照需要同时深拷贝 `history` 和 `future` 数组中的每个 `Sudoku` 实例。

**应对**：`exploreSnapshot` 保存时使用 `history.map(s => s.clone())`，恢复时同样逐项 clone。现有 `Sudoku.clone()` 机制完全满足需求。

---

## 7. 如果重做一次 Homework 1，你会如何修改原设计？

### 7.1 为 `Game` 引入显式状态机

HW1 的 `Game` 是"无状态"的（只有数据，没有模式）。如果重做，会在 HW1 就引入一个轻量状态枚举：

```
GameMode: NORMAL | EXPLORING
```

这样 HW2 扩展时只需增加枚举值，而非事后添加布尔字段。状态机也让状态转换（进入探索 → 提交/放弃 → 回到正常）更加显式化和可测试。

### 7.2 为 `Sudoku` 预留分析接口

HW1 的 `Sudoku` 只有"写"操作（`guess`）和"读"操作（`getGrid`）。如果重做，会从一开始就设计 `getCandidates(row, col)` 作为基础分析接口——它是冲突检测的自然延伸（冲突检测本质上就是在判断"候选数是否为空"）。

### 7.3 序列化采用更结构化的版本号机制

HW1 的 `toJSON()` 没有版本字段。如果重做，会在 JSON 中增加 `version: 1` 字段，让反序列化时能根据版本号做兼容处理。这样 HW2 新增字段时，旧版本 JSON 可以明确识别并做降级处理。

### 7.4 提前考虑"快照"的通用化

HW1 的快照只用于 history 栈。如果重做，会将"保存完整 Game 状态"抽象为一个通用操作（如 `createCheckpoint()` / `restoreCheckpoint()`），探索模式直接复用，而非重复实现快照逻辑。

---

## 附录：设计决策总结

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Hint 归属 | `Sudoku` 计算 + `Game` 暴露 | 计算是盘面分析（Sudoku），接口是会话管理（Game） |
| Explore 本质 | 快照 + 子会话 | 比状态机更灵活，比 DAG 更简单 |
| 主/探关系 | 深拷贝副本 | 避免引用污染，保证放弃时完整恢复 |
| History 结构 | 线性栈 + 检查点 | 不引入树状复杂度，满足回溯需求 |
| 失败记忆 | `Set<string>`（cells JSON key） | O(1) 查找，自动去重，序列化友好 |
| 冲突检测 | Store 层自动触发 | 保持 `Game.guess` 纯粹，死路检测是"会话策略"而非"盘面逻辑" |
