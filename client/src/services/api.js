import axios from 'axios';

const api = axios.create({
  baseURL: 'https://enersight-ai-server.onrender.com/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('enerSightToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
