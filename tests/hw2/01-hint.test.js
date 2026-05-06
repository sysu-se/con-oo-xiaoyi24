import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 Hint — getCandidates', () => {
  it('返回空格的候选数集合（排除同行/列/宫已出现的数字）', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    // (0,2) 是空格，同行有 5,3,7，同列有 8，同宫有 5,3,6,9,8
    // 候选数 = 1-9 排除 {5,3,7,8,6,9} = {1,2,4}
    const cands = sudoku.getCandidates(0, 2)
    expect(cands).toEqual([1, 2, 4])
  })

  it('已填格子返回空数组', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    // (0,0) = 5，已填
    const cands = sudoku.getCandidates(0, 0)
    expect(cands).toEqual([])
  })

  it('填了一些数字后候选数正确更新', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    // 先在 (0,2) 填 4
    sudoku.guess({ row: 0, col: 2, value: 4 })
    // 现在 (0,3) 的候选数：
    //   同行 row0: {5,3,4,7}
    //   同列 col3: {1,8,4}
    //   同宫 (0,3)-(2,5): {7,1,9,5}
    //   排除 {5,3,4,7,1,8,9} = {2,6}
    const cands = sudoku.getCandidates(0, 3)
    expect(cands.sort()).toEqual([2, 6])
  })
})

describe('HW2 Hint — findNextMove', () => {
  it('找到第一个 Naked Single（唯一候选数格子）', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    // 先填几个数字让某个格子变成唯一候选
    sudoku.guess({ row: 0, col: 2, value: 4 })
    // (0,3) 候选数为 [2,6]，不是 Naked Single
    // 但填了 (0,2)=4 后，其他位置可能出现 Naked Single
    // findNextMove 扫描全盘找第一个唯一候选数格子
    const move = sudoku.findNextMove()
    expect(move).not.toBeNull()
    // 验证返回的 move 是合法的（该位置确实是空格且候选数唯一）
    expect(sudoku.getGrid()[move.row][move.col]).toBe(0)
    const cands = sudoku.getCandidates(move.row, move.col)
    expect(cands.length).toBe(1)
    expect(move.value).toBe(cands[0])
  })

  it('没有唯一候选数时返回 null', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    // 初始盘面通常没有 Naked Single（取决于题目）
    // 我们构造一个全空的盘面来测试
    const empty = Array.from({ length: 9 }, () => Array(9).fill(0))
    const emptySudoku = createSudoku(empty)
    const move = emptySudoku.findNextMove()
    // 全空盘面每个格子候选数都是 1-9，没有唯一候选
    expect(move).toBeNull()
  })
})
