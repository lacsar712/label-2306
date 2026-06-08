import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn()
  }
}))

import { ElMessage } from 'element-plus'

describe('Axios Interceptors', () => {
  let requestInterceptor
  let responseSuccessInterceptor
  let responseErrorInterceptor

  const mockLocationHref = vi.fn()
  const mockLocationPathname = vi.fn(() => '/')

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockLocationPathname.mockReturnValue('/')

    Object.defineProperty(window, 'location', {
      value: {
        get href() {
          return mockLocationHref() || 'http://localhost/'
        },
        set href(value) {
          mockLocationHref.mockReturnValue(value)
        },
        get pathname() {
          return mockLocationPathname()
        }
      },
      writable: true,
      configurable: true
    })

    const mockAxiosInstance = {
      interceptors: {
        request: {
          use: vi.fn((handler) => {
            requestInterceptor = handler
          })
        },
        response: {
          use: vi.fn((successHandler, errorHandler) => {
            responseSuccessInterceptor = successHandler
            responseErrorInterceptor = errorHandler
          })
        }
      }
    }

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => mockAxiosInstance)
      }
    }))

    vi.resetModules()
  })

  const loadAxiosModule = async () => {
    const mod = await import('../../api/axios')
    return mod.default
  }

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists in localStorage', async () => {
      await loadAxiosModule()

      localStorage.setItem('token', 'my-jwt-token')
      const config = { headers: {} }
      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBe('Bearer my-jwt-token')
    })

    it('should not add Authorization header when token is not in localStorage', async () => {
      await loadAxiosModule()

      const config = { headers: {} }
      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBeUndefined()
    })

    it('should filter out empty string, null, and undefined params', async () => {
      await loadAxiosModule()

      const config = {
        headers: {},
        params: {
          keyword: 'test',
          empty: '',
          nullValue: null,
          undefinedValue: undefined,
          page: 1
        }
      }
      const result = requestInterceptor(config)

      expect(result.params).toEqual({ keyword: 'test', page: 1 })
      expect(result.params.empty).toBeUndefined()
      expect(result.params.nullValue).toBeUndefined()
      expect(result.params.undefinedValue).toBeUndefined()
    })

    it('should leave params untouched if not an object', async () => {
      await loadAxiosModule()

      const config = { headers: {}, params: 'string-param' }
      const result = requestInterceptor(config)

      expect(result.params).toBe('string-param')
    })
  })

  describe('Response Success Interceptor', () => {
    it('should return response.data for normal responses', async () => {
      await loadAxiosModule()

      const response = {
        data: { success: true, message: 'ok' },
        config: {}
      }
      const result = responseSuccessInterceptor(response)

      expect(result).toEqual({ success: true, message: 'ok' })
    })

    it('should return response.data for blob responses', async () => {
      await loadAxiosModule()

      const blobData = new Blob(['file content'])
      const response = {
        data: blobData,
        config: { responseType: 'blob' }
      }
      const result = responseSuccessInterceptor(response)

      expect(result).toBe(blobData)
    })
  })

  describe('Response Error Interceptor', () => {
    it('should clear localStorage and redirect to /login on 401 when not on login page', async () => {
      await loadAxiosModule()

      localStorage.setItem('token', 'old-token')
      localStorage.setItem('user', JSON.stringify({ id: 1 }))
      mockLocationPathname.mockReturnValue('/dashboard')

      const error = {
        response: {
          status: 401,
          data: { error: '未授权' }
        }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
      expect(mockLocationHref()).toBe('/login')
      expect(ElMessage.error).toHaveBeenCalledWith('未授权')
    })

    it('should clear localStorage but NOT redirect when already on /login page with 401', async () => {
      await loadAxiosModule()

      localStorage.setItem('token', 'old-token')
      localStorage.setItem('user', JSON.stringify({ id: 1 }))
      mockLocationPathname.mockReturnValue('/login')
      mockLocationHref.mockReturnValue('http://localhost/login')

      const error = {
        response: {
          status: 401,
          data: { error: '未授权' }
        }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
      expect(mockLocationHref()).toBe('http://localhost/login')
    })

    it('should show error message from response data on non-401 errors', async () => {
      await loadAxiosModule()

      localStorage.setItem('token', 'valid-token')
      const error = {
        response: {
          status: 500,
          data: { error: '服务器内部错误' }
        }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(localStorage.getItem('token')).toBe('valid-token')
      expect(ElMessage.error).toHaveBeenCalledWith('服务器内部错误')
    })

    it('should show default error message when response has no error data', async () => {
      await loadAxiosModule()

      const error = {
        response: {
          status: 404,
          data: {}
        }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(ElMessage.error).toHaveBeenCalledWith('网络错误，请稍后重试')
    })

    it('should show default error message for network errors without response', async () => {
      await loadAxiosModule()

      const error = new Error('Network Error')

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(ElMessage.error).toHaveBeenCalledWith('网络错误，请稍后重试')
    })
  })
})
