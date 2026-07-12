import api from "./api";

export const maintenanceApi = {
  /** GET / — filters: vehicle_id, status_filter */
  list: async (params = {}) => {
    const { data } = await api.get("/maintenance", { params });
    return data;
  },

  getById: async (maintenanceId) => {
    const { data } = await api.get(`/maintenance/${maintenanceId}`);
    return data;
  },

  /** POST — Fleet Manager, Admin. Auto-sets vehicle status to In Shop (Rule 9). */
  create: async (payload) => {
    const { data } = await api.post("/maintenance", payload);
    return data;
  },

  update: async (maintenanceId, payload) => {
    const { data } = await api.patch(`/maintenance/${maintenanceId}`, payload);
    return data;
  },

  /** POST /{id}/close — Fleet Manager, Admin. Restores vehicle status (Rule 10). */
  close: async (maintenanceId) => {
    const { data } = await api.post(`/maintenance/${maintenanceId}/close`);
    return data;
  },
};

export default maintenanceApi;
