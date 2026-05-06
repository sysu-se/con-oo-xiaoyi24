import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 Explore — enter / commit / abandon', () => {
  it('可以进入探索模式', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    expect(game.isExploring()).toBe(false)
    const ok = game.enterExplore()
    expect(ok).toBe(true)
    expect(game.isExploring()).toBe(true)
  })

  it('不支持嵌套探索', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    const ok = game.enterExplore()
    expect(ok).toBe(false)
    expect(game.isExploring()).toBe(true)
  })

  it('提交探索结果后退出探索模式，保留盘面', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    expect(game.getGrid()[0][2]).toBe(4)

    game.commitExplore()
    expect(game.isExploring()).toBe(false)
    // 提交后盘面保留
    expect(game.getGrid()[0][2]).toBe(4)
  })

  it('放弃探索后恢复到进入前的状态', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    // 先走一步（非探索模式）
    game.guess({ row: 0, col: 2, value: 4 })
    expect(game.getGrid()[0][2]).toBe(4)

    // 进入探索
    game.enterExplore()
    // 在探索中再走一步
    game.guess({ row: 1, col: 1, value: 7 })
    expect(game.getGrid()[1][1]).toBe(7)

    // 放弃探索
    game.abandonExplore()
    expect(game.isExploring()).toBe(false)
    // 恢复到进入探索前的状态：只有 (0,2)=4，(1,1) 恢复为 0
    expect(game.getGrid()[0][2]).toBe(4)
    expect(game.getGrid()[1][1]).toBe(0)
  })

  it('放弃探索后 history 也恢复到进入前', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    expect(game.canUndo()).toBe(true)

    game.enterExplore()
    game.guess({ row: 1, col: 1, value: 7 })
    game.guess({ row: 2, col: 0, value: 1 })

    game.abandonExplore()
    // 放弃后 history 恢复到进入前：只有一步 guess
    expect(game.canUndo()).toBe(true)
    game.undo()
    expect(game.getGrid()[0][2]).toBe(0)
    expect(game.canUndo()).toBe(false)
  })
})

describe('HW2 Explore — dead end detection', () => {
  it('冲突时标记死路', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    // 填一个和同行已有数字冲突的值
    game.guess({ row: 0, col: 2, value: 5 }) // 同行 (0,0) 已经是 5
    game.markExploreDeadEnd()

    expect(game.isDeadEnd()).toBe(true)
  })

  it('未冲突时不标记死路', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 }) // 不冲突

    expect(game.isDeadEnd()).toBe(false)
  })

  it('非探索模式下 isDeadEnd 始终返回 false', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 5 }) // 冲突
    expect(game.isDeadEnd()).toBe(false)
  })
})

describe('HW2 Explore — undo/redo 在探索中仍然可用', () => {
  it('探索中 undo/redo 正常工作', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })

    expect(game.getGrid()[0][2]).toBe(4)
    expect(game.getGrid()[1][1]).toBe(7)

    game.undo()
    expect(game.getGrid()[1][1]).toBe(0)
    expect(game.getGrid()[0][2]).toBe(4)

    game.redo()
    expect(game.getGrid()[1][1]).toBe(7)
  })
})
