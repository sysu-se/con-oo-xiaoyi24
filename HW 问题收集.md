# HW 问题收集

列举在 HW1、HW1.1 过程中，我遇到的 3 个通过自己学习已经解决的问题，以及 3 个目前还没有完全想透的问题与挑战。

## 已解决

1. 啥是“标量 derived store”，它在这次作业里到底有啥作用？
   1. 上下文：在 `DESIGN.md` 里看到一句话：“`invalidCells` derived store 只做简单透传”；对应代码在 `src/node_modules/@sudoku/stores/grid.js`：

      ```js
      export const invalidCells = derived(
        gameStore,
        ($gameStore) => $gameStore.invalidCells ?? [],
        []
      );
      ```

      一开始我不理解：既然 `invalidCells` 已经在 `$gameStore` 里面了，为什么还要单独导出一个 store？
   2. 解决手段：直接问 CA，顺着去看了 Svelte 官方关于 `derived` 的说明，再回头对照 `grid.js` 和 `game.js` 的消费方式。
   3. 目前理解：这里的 `derived store` 更像是“从大快照里切出一个单独字段的只读视图”。它不是在重新实现校验逻辑，而是在保留旧的消费接口、降低组件耦合。`invalidCells` 的计算已经内聚到 `Sudoku.getInvalidCells()`，这个 derived store 只是把结果以一个单独 store 的形式暴露出来，方便组件继续按 `$invalidCells` 使用。

2. 为什么 `Sudoku` 要拆成 `given` 和 `cells` 两份数据，而不是像 HW1 那样只保留一个 `grid`？
   1. 上下文：`DESIGN.md` 里提到 HW1 的问题是“无法区分题目固定格和玩家填写格”；当前实现的构造函数也变成了：

      ```js
      constructor(given, cells = null) {
        this.given = deepCopy2D(given);
        this.cells = cells !== null ? deepCopy2D(cells) : deepCopy2D(given);
      }
      ```

      并且 `guess()` 里先判断 `isGiven(row, col)`。
   2. 解决手段：先看老师作业要求，再对照 `src/domain/index.js`、`tests/hw1` 里的测试和自己的 `DESIGN.md` 说明，最后手动沿着“新建游戏 -> 输入数字 -> Undo/Redo -> 序列化”的链路想了一遍。
   3. 目前理解：只用一个 `grid` 的话，领域对象没法表达“哪些格子天生不可改”，这样 `guess()`、序列化/反序列化、UI 是否允许编辑都会变得含糊。拆成 `given` 和 `cells` 后，`Sudoku` 才真正承载了“数独盘面”这个业务概念，而不是一个普通二维数组。

3. 为什么 `getSudoku()` 不能直接把内部对象暴露出去，而要返回 `clone()`？
   1. 上下文：`DESIGN.md` 里专门写了这一点；当前 `Game` 的实现是：

      ```js
      getSudoku() {
        return this.sudoku.clone();
      }
      ```

      我最开始会觉得“直接 return `this.sudoku` 不是更省事吗”。
   2. 解决手段：先看了 `codex-review.md` 里对 HW1 的 review，再自己顺着 `game.guess()`、`history`、`future` 的逻辑模拟了一遍“如果外部直接改 `Sudoku` 会发生什么”。
   3. 目前理解：如果把内部 `sudoku` 实例直接暴露出去，外部代码就能绕过 `Game.guess()`，直接 `game.getSudoku().guess(...)`，这样历史快照根本不会记录，Undo/Redo 的一致性也会被破坏。返回 `clone()` 的意义不是“防修改”这么简单，而是保护 `Game` 作为会话边界和统一入口的职责。

## 未解决

1. `sameArea` 这种高亮逻辑，到底应该留在组件里，还是应该继续往 store / 领域对象里收？
   1. 上下文：`src/components/Board/index.svelte` 里有这段：

      ```js
      function isSameArea(cursorStore, x, y) {
        if (cursorStore.x === null && cursorStore.y === null) return false;
        if (cursorStore.x === x || cursorStore.y === y) return true;

        const cursorBoxX = Math.floor(cursorStore.x / BOX_SIZE);
        const cursorBoxY = Math.floor(cursorStore.y / BOX_SIZE);
        const cellBoxX = Math.floor(x / BOX_SIZE);
        const cellBoxY = Math.floor(y / BOX_SIZE);
        return (cursorBoxX === cellBoxX && cursorBoxY === cellBoxY);
      }
      ```

      以及：

      ```svelte
      sameArea={$settings.highlightCells && !isSelected($cursor, x, y) && isSameArea($cursor, x, y)}
      ```
   2. 目前卡点：我现在能看懂它的“功能”是高亮当前选中格子的同行、同列、同宫，但我还没完全想透它的“归属”。它看起来是纯 UI 逻辑，不像 `invalidCells` 那样属于领域规则；可如果以后类似高亮逻辑越来越多，组件层会不会又重新变重？
   3. 尝试解决手段：问过 CA，也回看了 `Board` 组件和 `Cell.svelte`，目前只能确定“它不是数独业务规则”，但还没完全形成稳定判断标准。

2. 既然 `$gameStore` 里已经有 `invalidCells` 字段，为什么还要保留额外的 `invalidCells` derived store？
   1. 上下文：现在两种写法理论上都能工作：

      ```js
      $gameStore.invalidCells
      ```

      和

      ```js
      $invalidCells
      ```

      但项目里仍然保留了：

      ```js
      export const invalidCells = derived(gameStore, ($gameStore) => $gameStore.invalidCells ?? [], []);
      ```
   2. 目前卡点：我已经理解它“能用”，也知道它对兼容旧组件接口有帮助，但我还没完全想明白这里的设计取舍边界。是应该优先减少导出数量，让组件都直接读 `$gameStore.invalidCells`；还是保留细粒度 store，让消费侧更清晰？
   3. 尝试解决手段：对照了 `stores/grid.js`、`stores/game.js` 和 `Board/index.svelte` 的用法，也查了一些别人写 Svelte store adapter 的例子，但还没有一个让我完全信服的答案。

3. `cursor`、`candidates`、`notes`、`timer` 这些状态，哪些应该继续留在独立 store，哪些应该进一步纳入 `Game` 的边界？
   1. 上下文：当前仓库里，`Game` 已经承接了棋盘、撤销/重做、冲突检测这些核心逻辑；但 `src/node_modules/@sudoku/stores/` 下仍然有 `cursor.js`、`candidates.js`、`notes.js`、`timer.js`、`game.js` 等多个独立 store。
   2. 目前卡点：我能理解“棋盘状态”必须由领域对象托管，但像候选数、光标、暂停状态、计时器这些信息，有些很像 UI 状态，有些又和玩法密切相关。我现在还没有一套很稳的标准去判断：什么算领域对象该负责的，什么算 Svelte 适配层或纯前端状态该负责的。
   3. 尝试解决手段：把 `DESIGN.md` 里“Store Adapter”的思路反复看了几遍，也顺着几个 store 的读写路径做了梳理；目前只能先做到“不把明显的业务规则放回组件里”，但对更细的分层边界仍然在摸索。
