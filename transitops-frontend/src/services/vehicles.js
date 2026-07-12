import api from "./api";

export const vehiclesApi = {
  list: async (params = {}) => {
    const { data } = await api.get("/vehicles", { params });
    return data;
  },

  /** GET /api/vehicles/dispatchable — Available vehicles only (for trip creation flow) */
  dispatchable: async () => {
    const { data } = await api.get("/vehicles/dispatchable");
    return data;
  },

  getById: async (vehicleId) => {
    const { data } = await api.get(`/vehicles/${vehicleId}`);
    return data;
  },

  /** POST — Fleet Manager, Admin only. Backend enforces unique registration number. */
  create: async (payload) => {
    const { data } = await api.post("/vehicles", payload);
    return data;
  },

  update: async (vehicleId, payload) => {
    const { data } = await api.patch(`/vehicles/${vehicleId}`, payload);
    return data;
  },

  remove: async (vehicleId) => {
    const { data } = await api.delete(`/vehicles/${vehicleId}`);
    return data;
  },
};

export default vehiclesApi;
