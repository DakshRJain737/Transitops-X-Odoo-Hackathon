import api from "./api";


 * Filters supported by GET /: status_filter, skip, limit
 */
export const driversApi = {
  list: async (params = {}) => {
    const { data } = await api.get("/drivers", { params });
    return data;
  },

  /** GET /api/drivers/assignable — Available drivers with a non-expired license (for trip dispatch) */
  assignable: async () => {
    const { data } = await api.get("/drivers/assignable");
    return data;
  },

  getById: async (driverId) => {
    const { data } = await api.get(`/drivers/${driverId}`);
    return data;
  },

  /** POST — Fleet Manager, Safety Officer, Admin. Backend enforces unique license number. */
  create: async (payload) => {
    const { data } = await api.post("/drivers", payload);
    return data;
  },

  update: async (driverId, payload) => {
    const { data } = await api.patch(`/drivers/${driverId}`, payload);
    return data;
  },

  remove: async (driverId) => {
    const { data } = await api.delete(`/drivers/${driverId}`);
    return data;
  },
};

export default driversApi;
