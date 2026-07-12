import api from "./api";

export const reportsApi = {
  /** GET /dashboard — KPIs: active/available vehicles, in-maintenance, active/pending trips, drivers on duty, utilization % */
  dashboard: async () => {
    const { data } = await api.get("/reports/dashboard");
    return data;
  },

  /** GET /fuel-efficiency — per-vehicle distance/fuel efficiency (km/L) */
  fuelEfficiency: async () => {
    const { data } = await api.get("/reports/fuel-efficiency");
    return data;
  },

  /** GET /operational-cost — per-vehicle fuel + maintenance + other expenses */
  operationalCost: async () => {
    const { data } = await api.get("/reports/operational-cost");
    return data;
  },

  /** GET /roi — per-vehicle ROI = (Revenue − (Maintenance + Fuel)) / Acquisition Cost */
  roi: async () => {
    const { data } = await api.get("/reports/roi");
    return data;
  },

  /**
   * GET /export?report_type= — CSV export (vehicles | drivers | trips).
   * Returns a raw Blob since the response is a file, not JSON — callers
   * pass this to a download helper (utils/downloadBlob.js, built later).
   */
  export: async (reportType) => {
    const response = await api.get("/reports/export", {
      params: { report_type: reportType },
      responseType: "blob",
    });
    return response.data;
  },
};

export default reportsApi;
