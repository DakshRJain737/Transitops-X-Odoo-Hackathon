import api from "./api";

export const adminApi = {
  listUsers: async () => {
    const { data } = await api.get("/admin/users");
    return data;
  },

  createUser: async (payload) => {
    const { data } = await api.post("/admin/users", payload);
    return data;
  },

  updateUser: async (userId, payload) => {
    const { data } = await api.patch(`/admin/users/${userId}`, payload);
    return data;
  },

  deleteUser: async (userId) => {
    const { data } = await api.delete(`/admin/users/${userId}`);
    return data;
  },

  deactivateUser: async (userId) => {
    const { data } = await api.post(`/admin/users/${userId}/deactivate`);
    return data;
  },

  activateUser: async (userId) => {
    const { data } = await api.post(`/admin/users/${userId}/activate`);
    return data;
  },

  /** Force-override endpoints — bypass normal workflow validation entirely */
  forceVehicleStatus: async (vehicleId, status) => {
    const { data } = await api.post(
      `/admin/vehicles/${vehicleId}/force-status`,
      { status }
    );
    return data;
  },

  forceDriverStatus: async (driverId, status) => {
    const { data } = await api.post(
      `/admin/drivers/${driverId}/force-status`,
      { status }
    );
    return data;
  },

  forceTripStatus: async (tripId, status) => {
    const { data } = await api.post(`/admin/trips/${tripId}/force-status`, {
      status,
    });
    return data;
  },

  /** GET /stats — system-wide counts: users by role, total vehicles/drivers/trips, inactive users */
  stats: async () => {
    const { data } = await api.get("/admin/stats");
    return data;
  },
};

export default adminApi;
