import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMemberStore } from '../member'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../api/member', () => ({
  getMemberBenefits: vi.fn()
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn()
  }
}))

import api from '../../api/axios'
import { getMemberBenefits } from '../../api/member'

describe('Member Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with default empty state', () => {
      const store = useMemberStore()
      expect(store.members).toEqual([])
      expect(store.total).toBe(0)
      expect(store.page).toBe(1)
      expect(store.pageSize).toBe(20)
      expect(store.totalPages).toBe(0)
      expect(store.stats).toEqual({
        total: 0,
        active: 0,
        levelStats: [],
        totalPoints: 0
      })
      expect(store.currentMemberBenefits).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('Actions', () => {
    describe('fetchMembers', () => {
      it('should fetch members and update state', async () => {
        const mockData = {
          list: [
            { id: 1, name: '张三', phone: '13800138001' },
            { id: 2, name: '李四', phone: '13800138002' }
          ],
          total: 100,
          page: 1,
          pageSize: 20,
          totalPages: 5
        }
        api.get.mockResolvedValue(mockData)

        const store = useMemberStore()
        await store.fetchMembers()

        expect(api.get).toHaveBeenCalledWith('/members', {
          params: { page: 1, pageSize: 20 }
        })
        expect(store.members).toEqual(mockData.list)
        expect(store.total).toBe(100)
        expect(store.page).toBe(1)
        expect(store.pageSize).toBe(20)
        expect(store.totalPages).toBe(5)
        expect(store.loading).toBe(false)
      })

      it('should pass custom params to API', async () => {
        const mockData = {
          list: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0
        }
        api.get.mockResolvedValue(mockData)

        const store = useMemberStore()
        await store.fetchMembers({ keyword: '张', level: 'VIP' })

        expect(api.get).toHaveBeenCalledWith('/members', {
          params: { page: 1, pageSize: 20, keyword: '张', level: 'VIP' }
        })
      })

      it('should set loading to true during fetch and false after completion', async () => {
        const mockData = {
          list: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0
        }
        let resolveFetch
        api.get.mockImplementation(() => new Promise(resolve => {
          resolveFetch = resolve
        }))

        const store = useMemberStore()
        const promise = store.fetchMembers()

        expect(store.loading).toBe(true)

        resolveFetch(mockData)
        await promise

        expect(store.loading).toBe(false)
      })

      it('should set loading to false even when API call fails', async () => {
        api.get.mockRejectedValue(new Error('Network error'))

        const store = useMemberStore()

        await expect(store.fetchMembers()).rejects.toThrow('Network error')

        expect(store.loading).toBe(false)
      })

      it('should throw error on API failure', async () => {
        api.get.mockRejectedValue({
          response: { data: { error: '获取会员列表失败' } }
        })

        const store = useMemberStore()

        await expect(store.fetchMembers()).rejects.toBeDefined()
      })

      it('should not modify member list on failure', async () => {
        const initialMembers = [{ id: 1, name: 'Existing' }]
        api.get.mockRejectedValue(new Error('Failed'))

        const store = useMemberStore()
        store.members = initialMembers

        try {
          await store.fetchMembers()
        } catch (e) {
          // expected
        }

        expect(store.members).toEqual(initialMembers)
      })
    })

    describe('fetchStats', () => {
      it('should fetch and update stats', async () => {
        const mockStats = {
          total: 500,
          active: 450,
          levelStats: [{ level: '普通', count: 300 }, { level: 'VIP', count: 200 }],
          totalPoints: 125000
        }
        api.get.mockResolvedValue(mockStats)

        const store = useMemberStore()
        await store.fetchStats()

        expect(api.get).toHaveBeenCalledWith('/stats')
        expect(store.stats).toEqual(mockStats)
      })

      it('should keep default stats on error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        api.get.mockRejectedValue(new Error('Failed'))

        const store = useMemberStore()
        const defaultStats = { ...store.stats }
        await store.fetchStats()

        expect(store.stats).toEqual(defaultStats)
        consoleSpy.mockRestore()
      })
    })

    describe('fetchMemberBenefits', () => {
      it('should fetch and return member benefits', async () => {
        const mockBenefits = {
          memberId: 1,
          level: 'VIP',
          benefits: [{ type: 'discount', value: 0.9 }]
        }
        getMemberBenefits.mockResolvedValue(mockBenefits)

        const store = useMemberStore()
        const result = await store.fetchMemberBenefits(1)

        expect(getMemberBenefits).toHaveBeenCalledWith(1)
        expect(store.currentMemberBenefits).toEqual(mockBenefits)
        expect(result).toEqual(mockBenefits)
      })

      it('should return null on error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        getMemberBenefits.mockRejectedValue(new Error('Failed'))

        const store = useMemberStore()
        const result = await store.fetchMemberBenefits(1)

        expect(result).toBeNull()
        consoleSpy.mockRestore()
      })
    })

    describe('setPage and setPageSize', () => {
      it('should update page', () => {
        const store = useMemberStore()
        store.setPage(3)
        expect(store.page).toBe(3)
      })

      it('should update pageSize and reset page to 1', () => {
        const store = useMemberStore()
        store.page = 5
        store.setPageSize(50)
        expect(store.pageSize).toBe(50)
        expect(store.page).toBe(1)
      })
    })
  })
})
