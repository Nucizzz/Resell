import axios from 'axios'

const VITE_API_BASE = import.meta.env.VITE_API_BASE || '/api'

export const api = axios.create({
  baseURL: VITE_API_BASE,
  timeout: 8000,
})

export function setApiKey(key: string) {
  api.defaults.headers.common['X-API-Key'] = key
}