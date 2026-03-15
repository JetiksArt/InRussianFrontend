import axios from 'axios';
import {AuthApi, Configuration} from '../api';
import { emitApiError, getApiErrorMessage } from '../utils/apiError';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api"
});

export const authApi = new AuthApi(
    new Configuration({basePath: axiosInstance.defaults.baseURL}),
    undefined,
    axiosInstance
);

let isRefreshing = false;

export function setTokens(accessToken: string | null, refreshToken?: string | null) {
    if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
    } else {
        localStorage.removeItem('accessToken');
    }
    if (refreshToken !== undefined) {
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        } else {
            localStorage.removeItem('refreshToken');
        }
    }
}

let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (error?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({resolve, reject}) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
};

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        const isAuthEndpoint = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');
        if (token && !isAuthEndpoint && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({resolve, reject});
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axiosInstance(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');

            if (refreshToken) {
                try {
                    const response = await axiosInstance.post('/auth/refresh', {
                        refreshToken: refreshToken
                    });

                    const {accessToken} = response.data;
                    localStorage.setItem('accessToken', accessToken);

                    processQueue(null, accessToken);

                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('userId');
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                isRefreshing = false;
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('userId');
            }
        }

        const status = error.response?.status;
        if (status === 403) {
            emitApiError(getApiErrorMessage(error));
        }

        return Promise.reject(error);
    }
);

export {axiosInstance};
