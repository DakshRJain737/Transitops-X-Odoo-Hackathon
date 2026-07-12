import api, { loginRequest } from "./api";

export const authApi = {
  /** POST /api/auth/register (public) */
  register: async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return data;
  },

  /** POST /api/auth/login (public, form-encoded) → { access_token, token_type } */
  login: async ({ email, password }) => loginRequest({ email, password }),

  /** GET /api/auth/me (any authenticated user) */
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },
};

export default authApi;
