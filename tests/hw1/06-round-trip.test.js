import { describe, it, expect } from 'vitest'
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js'

describe('Bonus: 十一、加分项 - 完整的 round-trip 测试', () => {
  it('serialize -> deserialize 应该能够实现无损的局面保存与对象复活', async () => {
    // 1. 加载我们在 index.js 导出的工厂函数
    const { createSudoku, createGame, createGameFromJSON } = await loadDomainApi();
    
    // 2. 原版游戏开始
    const grid = makePuzzle();
    const game = createGame({ sudoku: createSudoku(grid) });

    // 3. 模拟玩家连续的骚操作
    game.guess({ row: 0, col: 0, value: 5 }); // 走一步
    game.guess({ row: 0, col: 1, value: 6 }); // 再走一步
    game.guess({ row: 0, col: 2, value: 7 }); // 又走一步
    game.undo();                              // 撤销一步（产生未来记录 future）

    // ----- 关键动作：序列化（保存游戏档案） -----
    // 把当前复杂的游戏对象，转化为一长串死气沉沉的 JSON 文本字符串
    const savedArchiveString = JSON.stringify(game.toJSON());

    // ----- 关键动作：反序列化（读取游戏档案） -----
    // 拿着那个文本字符串，强行无损复原出一个活灵活现的新游戏对象！
    const parsedArchiveObject = JSON.parse(savedArchiveString);
    const revivedGame = createGameFromJSON(parsedArchiveObject);

    // 4. 断言验证：复活后的游戏如果能通过以下所有测试，证明 10分 到手！
    
    // (a) 首先验证当下的数独数字一模一样
    expect(revivedGame.getSudoku().getGrid()).toEqual(game.getSudoku().getGrid());
    
    // (b) 验证复活后的重做/撤销按钮是否正常亮起
    expect(revivedGame.canUndo()).toBe(game.canUndo());
    expect(revivedGame.canRedo()).toBe(game.canRedo());
    expect(revivedGame.canUndo()).toBe(true);
    expect(revivedGame.canRedo()).toBe(true);

    // (c) 验证：复活后的游戏能够拥有行为能力！继续重做刚才被撤销的那一步
    revivedGame.redo();
    game.redo();
    expect(revivedGame.getSudoku().getGrid()).toEqual(game.getSudoku().getGrid());

    // (d) 验证极限深层比对，整个底层堆栈必须连毛孔都不差
    expect(revivedGame.toJSON()).toEqual(game.toJSON());
  });
})