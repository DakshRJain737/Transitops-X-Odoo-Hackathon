import axios from "axios";
import { getAuthState, useAuthStore } from "../store/authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * REQUEST INTERCEPTOR
 * Attaches the JWT bearer token from the auth store to every outgoing request.
 * Individual service files (services/vehicles.js etc.) never need to touch auth headers.
 */
api.interceptors.request.use(
  (config) => {
    const token = getAuthState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * RESPONSE INTERCEPTOR
 * - Normalizes FastAPI error shapes ({ detail: "..." } or { detail: [{msg,...}] } for
 *   Pydantic validation errors) into a consistent `error.message` string so the Toast
 *   system can display it directly without every call site parsing response.data itself.
 * - On 401, the token is invalid/expired — clear the session and bounce to /login.
 *   Skipped for the login endpoint itself, where a 401 just means "wrong password"
 *   and should surface as a normal form error, not a forced redirect.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    let message = "Something went wrong. Please try again.";
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail[0]?.msg) {
      // Pydantic v2 validation error array shape: [{ loc, msg, type }]
      message = detail.map((d) => d.msg).join(", ");
    } else if (error.message === "Network Error") {
      message =
        "Can't reach the TransitOps server. Is the backend running on " +
        BASE_URL +
        "?";
    } else if (error.code === "ECONNABORTED") {
      message = "Request timed out. Please try again.";
    }

    const isLoginRequest = error.config?.url?.includes("/auth/login");

    if (status === 401 && !isLoginRequest) {
      useAuthStore.getState().clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject({ ...error, message });
  }
);

/**
 * LOGIN — special-cased because FastAPI's OAuth2PasswordRequestForm expects
 * application/x-www-form-urlencoded with `username` (=email) and `password`,
 * not JSON like every other endpoint in this API.
 */
export async function loginRequest({ email, password }) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data; // { access_token, token_type }
}

export default api;