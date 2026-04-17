# con-oo-xiaoyi24 - Review

## Review 结论

当前实现已经把 Game/Sudoku 接入了棋盘渲染、输入和 Undo/Redo，说明不是“只在测试里有领域对象”。但接入仍不彻底：Game 还不是唯一权威源，且 history 语义被无效操作与 notes 模式破坏，所以整体只能评为中等，距离高质量 OOD 和干净的 Svelte 接入还有明显差距。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | good |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 笔记模式通过 guess(0) 伪造棋盘操作，污染 Undo/Redo 历史

- 严重程度：core
- 位置：src/components/Controls/Keyboard.svelte:12-19; src/domain/index.js:134-141
- 原因：在 notes 模式下，组件先改 candidates，再调用 gameStore.guess($cursor, 0)。而 Game.guess 会无条件写入 history 并清空 future，所以纯笔记操作也会制造撤销点。这样 notes 既没有被建模为领域状态，又破坏了数独游戏里“撤销一步棋盘变更”的业务语义。

### 2. Game.guess 在校验前记录历史，导致无效或无变化操作也会进入历史

- 严重程度：core
- 位置：src/domain/index.js:134-141
- 原因：Game.guess 先 push 当前快照，再调用 Sudoku.guess(move)，并且完全忽略 Sudoku.guess 的返回值。越界、固定格、非法 value，甚至对当前值没有实际变化的写入，都会生成历史记录并清空 redo。这说明领域操作没有形成“成功变更才提交”的事务边界。

### 3. 开局和部分交互仍由旧 grid store 驱动，Game 不是唯一权威源

- 严重程度：major
- 位置：src/node_modules/@sudoku/game.js:13-34; src/node_modules/@sudoku/stores/grid.js:13-31; src/node_modules/@sudoku/stores/grid.js:62-67; src/node_modules/@sudoku/stores/keyboard.js:1-10
- 原因：开始新游戏/加载自定义题目时，先更新 legacy 的 grid store，再由 gameStore 订阅该 store 去重建 Game。与此同时，keyboardDisabled 仍直接依赖 grid store 判断固定格。这样 View 并不是直接以 Game 或 adapter 为唯一入口，而是保留了“旧状态 + 新领域对象”双轨结构，不符合作业强调的真实接入和清晰边界。

### 4. 提示逻辑停留在 Store Adapter，而不是领域操作

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:91-97
- 原因：applyHint 直接在 adapter 中对当前盘面调用 solveSudoku，再把结果回写给 game.guess。提示本质上是游戏业务动作，但现在既不属于 Game，也不属于 Sudoku，领域层无法约束提示的前置条件、结果来源和异常语义，职责边界不够稳定。

### 5. 对外序列化仍绕过领域对象，继续读取旧 grid store

- 严重程度：minor
- 位置：src/components/Modal/Types/Share.svelte:5-13
- 原因：分享功能直接从 grid store 编码 sencode，而不是使用 Sudoku/Game 的 toJSON/toString 或等价外表化接口。虽然这不直接阻塞核心对局，但说明序列化职责没有真正收口到领域层，旧状态通道仍在对外暴露。

## 优点

### 1. Sudoku 清楚地区分 given 和 cells，并在 clone 中保留两者

- 位置：src/domain/index.js:10-13; src/domain/index.js:15-36; src/domain/index.js:38-40
- 原因：这让“题目固定格”和“玩家当前填写”成为明确的领域概念，既支持只读格判断，也支持基于快照的 Undo/Redo，不再把所有状态混成一个二维数组。

### 2. 校验和外表化能力大体留在领域层

- 位置：src/domain/index.js:43-87; src/domain/index.js:167-173
- 原因：invalidCells 的计算、toJSON 和 toString 都在 Sudoku/Game 内部完成，没有把冲突检测散落到组件里，这比把规则写进 Svelte 事件函数更符合 OOP 和 OOD。

### 3. 采用了面向 Svelte 的 Store Adapter，而不是让组件直接操作领域对象内部字段

- 位置：src/node_modules/@sudoku/stores/grid.js:50-80
- 原因：gameStore 通过 sync() 把 Game 的状态打成纯数据快照后再 set 给 writable，符合 Svelte 3 依赖赋值触发更新的机制，也避免了直接 mutate 类实例内部字段导致界面不刷新的典型问题。

### 4. 主要对局流程已经消费 gameStore 而不是直接改旧数组

- 位置：src/components/Board/index.svelte:40-52; src/components/Controls/Keyboard.svelte:20-25; src/components/Controls/ActionBar/Actions.svelte:26-32
- 原因：棋盘渲染来自 $gameStore.grid，常规数字输入经过 gameStore.guess，Undo/Redo 经过 gameStore.undo/redo。这说明“当前局面展示”和“主要用户输入”已经基本接上了领域对象链路。

## 补充说明

- 本结论仅基于静态阅读 src/domain/index.js 及其在 src/node_modules/@sudoku/*、src/components/**/* 中的接线关系，未运行测试。
- 关于 Undo/Redo、notes、hint、分享链路的判断，来自组件事件处理、store 依赖和领域方法调用链的静态审查，而非实际交互验证。
- 本次审查按要求未扩展到无关目录，也未把 DESIGN.md 或测试代码纳入结论。
