import { ofetch } from 'ofetch'

export const api = ofetch.create({
  baseURL: '/api',
  onResponse({ response }) {
    if (response._data && typeof response._data === 'object' && 'data' in response._data) {
      response._data = response._data.data
    }
  },
})
