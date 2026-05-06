import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 Explore — serialization round-trip', () => {
  it('探索状态可以序列化和反序列化', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    game.markExploreDeadEnd()

    const json = game.toJSON()
    expect(json.exploring).toBe(true)
    expect(json.exploreSnapshot).not.toBeNull()
    expect(json.failedSnapshots.length).toBeGreaterThan(0)

    // 反序列化
    const restored = createGameFromJSON(JSON.parse(JSON.stringify(json)))
    expect(restored.isExploring()).toBe(true)
    expect(restored.isDeadEnd()).toBe(true)
    expect(restored.getGrid()).toEqual(game.getGrid())
  })

  it('非探索状态的序列化不包含 explore 数据', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })

    const json = game.toJSON()
    expect(json.exploring).toBe(false)
    expect(json.exploreSnapshot).toBeNull()
    expect(json.failedSnapshots).toEqual([])
  })

  it('提交探索后序列化 exploring=false', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    game.commitExplore()

    const json = game.toJSON()
    expect(json.exploring).toBe(false)

    const restored = createGameFromJSON(JSON.parse(JSON.stringify(json)))
    expect(restored.isExploring()).toBe(false)
    expect(restored.getGrid()[0][2]).toBe(4)
  })
})
