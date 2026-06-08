import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'

vi.mock('../../api/axios', () => ({
  default: {
    post: vi.fn()
  }
}))

import axios from '../../api/axios'

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn()
  }
}))

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with null token and user when localStorage is empty', () => {
      const store = useAuthStore()
      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
    })

    it('should initialize token and user from localStorage', () => {
      const mockUser = { id: 1, username: 'admin', role: 'ADMIN' }
      localStorage.setItem('token', 'test-token-123')
      localStorage.setItem('user', JSON.stringify(mockUser))
      setActivePinia(createPinia())
      const store = useAuthStore()
      expect(store.token).toBe('test-token-123')
      expect(store.user).toEqual(mockUser)
    })
  })

  describe('Getters', () => {
    it('isAuthenticated should return true when token exists', () => {
      const store = useAuthStore()
      store.token = 'test-token'
      expect(store.isAuthenticated).toBe(true)
    })

    it('isAuthenticated should return false when token is null', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
    })

    it('isAdmin should return true when user role is ADMIN', () => {
      const store = useAuthStore()
      store.user = { id: 1, role: 'ADMIN' }
      expect(store.isAdmin).toBe(true)
    })

    it('isAdmin should return false when user role is not ADMIN', () => {
      const store = useAuthStore()
      store.user = { id: 1, role: 'USER' }
      expect(store.isAdmin).toBe(false)
    })

    it('isAdmin should return false when user is null', () => {
      const store = useAuthStore()
      expect(store.isAdmin).toBe(false)
    })
  })

  describe('Actions', () => {
    describe('login', () => {
      it('should store token and user in state and localStorage on successful login', async () => {
        const mockResponse = {
          token: 'jwt-token-abc123',
          user: { id: 1, username: 'admin', role: 'ADMIN' }
        }
        axios.post.mockResolvedValue(mockResponse)

        const store = useAuthStore()
        const result = await store.login('admin', 'password123')

        expect(axios.post).toHaveBeenCalledWith('/auth/login', {
          username: 'admin',
          password: 'password123'
        })
        expect(result).toBe(true)
        expect(store.token).toBe('jwt-token-abc123')
        expect(store.user).toEqual(mockResponse.user)
        expect(localStorage.getItem('token')).toBe('jwt-token-abc123')
        expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockResponse.user)
      })

      it('should throw error message from response data on login failure', async () => {
        axios.post.mockRejectedValue({
          response: {
            data: { error: '用户名或密码错误' }
          }
        })

        const store = useAuthStore()
        await expect(store.login('wrong', 'wrong')).rejects.toBe('用户名或密码错误')
      })

      it('should throw default error message when response has no error data', async () => {
        axios.post.mockRejectedValue({})

        const store = useAuthStore()
        await expect(store.login('wrong', 'wrong')).rejects.toBe('登录失败')
      })

      it('should not modify localStorage on login failure', async () => {
        axios.post.mockRejectedValue({ response: { data: { error: '失败' } } })

        const store = useAuthStore()
        try {
          await store.login('wrong', 'wrong')
        } catch (e) {
          // expected
        }

        expect(store.token).toBeNull()
        expect(store.user).toBeNull()
        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
      })
    })

    describe('logout', () => {
      it('should clear token and user from state and localStorage', async () => {
        axios.post.mockResolvedValue({})

        const store = useAuthStore()
        store.token = 'existing-token'
        store.user = { id: 1, username: 'test' }
        localStorage.setItem('token', 'existing-token')
        localStorage.setItem('user', JSON.stringify(store.user))

        await store.logout()

        expect(axios.post).toHaveBeenCalledWith('/auth/logout')
        expect(store.token).toBeNull()
        expect(store.user).toBeNull()
        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
      })

      it('should still clear state and localStorage even if API call fails', async () => {
        axios.post.mockRejectedValue(new Error('Network error'))

        const store = useAuthStore()
        store.token = 'existing-token'
        store.user = { id: 1, username: 'test' }
        localStorage.setItem('token', 'existing-token')
        localStorage.setItem('user', JSON.stringify(store.user))

        await store.logout()

        expect(store.token).toBeNull()
        expect(store.user).toBeNull()
        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
      })
    })
  })
})
