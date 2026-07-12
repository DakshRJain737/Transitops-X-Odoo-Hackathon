import api from "./api";

export const tripsApi = {
  /** GET / — filters: status_filter, vehicle_id, driver_id, skip, limit */
  list: async (params = {}) => {
    const { data } = await api.get("/trips", { params });
    return data;
  },

  getById: async (tripId) => {
    const { data } = await api.get(`/trips/${tripId}`);
    return data;
  },

  /** POST / — Draft status. Backend validates cargo weight ≤ vehicle max capacity (Rule 5). */
  create: async (payload) => {
    const { data } = await api.post("/trips", payload);
    return data;
  },

  /** POST /{id}/dispatch — full validation chain (Rules 2,3,4,5,6). Sets vehicle+driver → On Trip. */
  dispatch: async (tripId) => {
    const { data } = await api.post(`/trips/${tripId}/dispatch`);
    return data;
  },

  /** POST /{id}/complete — body: { actual_distance, fuel_consumed }. Resets vehicle+driver → Available (Rule 7). */
  complete: async (tripId, { actual_distance, fuel_consumed }) => {
    const { data } = await api.post(`/trips/${tripId}/complete`, {
      actual_distance,
      fuel_consumed,
    });
    return data;
  },

  /** POST /{id}/cancel — restores vehicle+driver → Available if it was dispatched (Rule 8). */
  cancel: async (tripId) => {
    const { data } = await api.post(`/trips/${tripId}/cancel`);
    return data;
  },
};

export default tripsApi;
