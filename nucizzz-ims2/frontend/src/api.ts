import axios from 'axios'
const base = import.meta.env.VITE_API_BASE || '/api'
export const api = axios.create({ baseURL: base })
api.interceptors.request.use(cfg => { const t=import.meta.env.VITE_ADMIN_TOKEN; if(t) cfg.headers['X-Admin-Token']=t; return cfg })
