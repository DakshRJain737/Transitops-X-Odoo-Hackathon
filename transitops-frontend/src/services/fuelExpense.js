import api from "./api";

export const fuelExpenseApi = {
  // ---- Fuel Logs ----
  listFuelLogs: async (params = {}) => {
    const { data } = await api.get("/fuel-logs", { params }); // filter: vehicle_id
    return data;
  },

  /** POST — Fleet Manager, Driver, Financial Analyst, Admin. May optionally link to a trip_id. */
  createFuelLog: async (payload) => {
    const { data } = await api.post("/fuel-logs", payload);
    return data;
  },

  // ---- Expenses ----
  listExpenses: async (params = {}) => {
    const { data } = await api.get("/expenses", { params }); // filter: vehicle_id
    return data;
  },

  createExpense: async (payload) => {
    const { data } = await api.post("/expenses", payload);
    return data;
  },
};

export default fuelExpenseApi;
