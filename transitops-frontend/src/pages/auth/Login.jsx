import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../services/auth";
import { ROLE_OPTIONS } from "../../constants/roles";

/**
 * Demo account hints keyed by role — purely a UX convenience for hackathon
 * judges/demos so picking a role can pre-fill a plausible email. Role is
 * NOT sent to the login API (backend derives it from the account itself via
 * GET /api/auth/me after login) — this selector only pre-fills the email field.
 */
const DEMO_EMAIL_BY_ROLE = {
  admin: "admin@transitops.io",
  fleet_manager: "fleet.manager@transitops.io",
  driver: "driver@transitops.io",
  safety_officer: "safety.officer@transitops.io",
  financial_analyst: "finance@transitops.io",
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [serverError, setServerError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: "", password: "", role: "" },
  });

  function handleRoleSelect(e) {
    const role = e.target.value;
    setValue("role", role);
    const demoEmail = DEMO_EMAIL_BY_ROLE[role];
    if (demoEmail) setValue("email", demoEmail);
  }

  async function onSubmit({ email, password }) {
    setServerError("");
    try {
      // 1. Authenticate — returns { access_token, token_type }
      const { access_token } = await authApi.login({ email, password });

      // 2. Temporarily seed the token so the axios interceptor (services/api.js)
      //    attaches it to this next call automatically.
      useAuthStore.setState({ token: access_token });

      // 3. Fetch the full profile (includes role) now that we're authenticated.
      const user = await authApi.me();

      // 4. Commit the real session. "Remember me" unchecked = session still
      //    persists via Zustand's persist middleware for this tab, but a
      //    production build would pair this flag with sessionStorage instead
      //    of localStorage — noted here as the intended extension point.
      setSession({ user, token: access_token });

      const redirectTo = location.state?.from ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(
        err.message || "Invalid email or password. Please try again."
      );
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Welcome back
        </h2>
        <p className="text-sm text-muted mt-1.5">
          Sign in to your TransitOps account to continue.
        </p>
      </div>

      <AnimatePresence>
        {serverError && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-danger-bg border border-danger-500/25 text-sm text-danger-400 overflow-hidden"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {serverError}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Demo role selector — convenience only, not sent to the API */}
        <Select
          label="Sign in as (demo)"
          placeholder="Select a role to pre-fill demo email"
          options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          onChange={handleRoleSelect}
          hint="Optional — for quick demo access. Password still required."
        />

        <Input
          label="Email"
          type="email"
          placeholder="you@transitops.io"
          leftIcon={<Mail />}
          required
          error={errors.email?.message}
          {...register("email", {
            required: "Email is required",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Enter a valid email address",
            },
          })}
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          leftIcon={<Lock />}
          required
          error={errors.password?.message}
          {...register("password", {
            required: "Password is required",
            minLength: {
              value: 6,
              message: "Password must be at least 6 characters",
            },
          })}
        />

        <div className="flex items-center justify-between text-sm pt-1">
          <label className="flex items-center gap-2 text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border-strong bg-surface-600 text-accent-500 focus:ring-accent-500 focus:ring-offset-0 cursor-pointer accent-accent-500"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-accent-400 hover:text-accent-300 transition-colors font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          isLoading={isSubmitting}
          rightIcon={<LogIn />}
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-muted mt-8">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
        >
          Contact your administrator
        </Link>
      </p>
    </motion.div>
  );
}