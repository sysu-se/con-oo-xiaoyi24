# oo-xiaoyi24 - Review

## Review 结论

当前实现已经有 Sudoku 和 Game 的基本分层，也实现了基于快照的 Undo/Redo 与 JSON 序列化雏形；但核心问题是领域模型没有真正承载“数独”业务约束，且 Game 对可变 Sudoku 的封装边界被直接暴露，导致对象设计更像“二维数组编辑器 + 历史栈”，距离高质量 OOP/OOD 还有明显差距。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | poor |
| OOD | fair |

## 缺点

### 1. Game 暴露内部可变 Sudoku，允许绕过历史管理

- 严重程度：core
- 位置：src/domain/index.js:54-65
- 原因：getSudoku() 直接返回内部 sudoku 实例，而 Sudoku 本身又提供可变的 guess()。这意味着外部代码可以通过 game.getSudoku().guess(...) 直接改盘面，完全绕过 Game.guess() 中的 history/future 维护逻辑。这样会破坏 Undo/Redo 的一致性，也削弱了 Game 作为会话边界和 UI 主入口的设计目标。

### 2. Sudoku 没有承载数独业务规则，只是一个可写二维数组

- 严重程度：core
- 位置：src/domain/index.js:12-16
- 原因：guess() 只做了行列越界判断，然后直接写值。代码中没有“固定题面格不可修改”的建模，也没有对 value 的合法范围、行/列/宫冲突、清空语义等进行约束。结果是领域对象无法表达“这是一个数独盘面”的核心业务含义，序列化后也只能恢复裸 grid，不能恢复题面与玩家输入的边界。

### 3. 构造器不维护 9x9 盘面的基本不变量

- 严重程度：major
- 位置：src/domain/index.js:2-5
- 原因：constructor() 对传入 grid 不做结构和数据校验，任何形状的数组、缺行缺列、包含异常值的数据都能进入对象。这样会把对象正确性完全交给调用方，toString()、guess()、toJSON() 都建立在“输入刚好合法”的脆弱前提上，不符合领域对象应主动维护自身不变量的设计习惯。

### 4. 深拷贝依赖 JSON 序列化，策略与数据表示耦合过紧

- 严重程度：minor
- 位置：src/domain/index.js:4,9,20
- 原因：JSON.parse(JSON.stringify(...)) 在当前纯数字 grid 上碰巧可用，但这是对数据形状的隐式假设，不是清晰的领域复制策略。它会丢失 undefined、特殊值和原型信息，也让 clone/getGrid 的语义依赖于“当前恰好是可 JSON 化结构”，不太符合 JS 生态里更明确的复制做法。

## 优点

### 1. 至少完成了 Sudoku 与 Game 的职责分层

- 位置：src/domain/index.js:1-27,47-52
- 原因：盘面状态与游戏会话/历史记录被拆成两个对象，而不是继续散落在 UI 或全局变量里，这一点符合题目要求的基本方向。

### 2. Undo/Redo 的主流程语义基本完整

- 位置：src/domain/index.js:58-65,75-89
- 原因：guess() 前先保存历史快照，undo() 把当前状态推进 future，redo() 再从 future 恢复；同时新输入会清空 future，符合题目要求中的历史行为规则。

### 3. 历史记录使用盘面快照，避免直接共享 grid 引用

- 位置：src/domain/index.js:18-20,60,78,86
- 原因：clone() 和历史栈的使用体现了对深浅拷贝问题的基本意识，至少避免了把同一个 grid 引用反复塞进 history/future 的明显错误。

### 4. toString() 具有可读的调试价值

- 位置：src/domain/index.js:29-44
- 原因：文本输出按 3x3 宫分隔，并将 0/null 显示为 .，比默认对象打印更适合人工检查当前盘面。

### 5. 序列化覆盖了当前局面和历史状态

- 位置：src/domain/index.js:91-120
- 原因：toJSON()/createGameFromJSON() 不只保存当前 sudoku，也保存了 history 和 future，使 Undo/Redo 相关状态具备 round-trip 的基础。

## 补充说明

- 本次结论仅基于对 src/domain/index.js 的静态阅读；当前 src/domain/* 下只发现这一个文件。
- 按要求未运行测试，因此对 Undo/Redo、序列化恢复、非法输入处理等行为的判断均来自代码路径推断，而非实际执行结果。
- 本次未审查 src/domain/* 之外的目录，因此“逻辑是否仍散落在 UI 中”只能根据 domain 层自身实现做局部判断。
