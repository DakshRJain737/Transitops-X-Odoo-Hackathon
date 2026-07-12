import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, UserPlus, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../services/auth";
import { ROLE_OPTIONS } from "../../constants/roles";

/**
 * Register — self-service account creation.
 * Calls POST /api/auth/register, then auto-logs the user in so they land
 * directly on the dashboard — zero friction for an MVP/hackathon demo.
 */
export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      full_name: "",
      email: "",
      role: "",
      password: "",
      confirm_password: "",
    },
  });

  const password = watch("password");

  async function onSubmit({ full_name, email, role, password }) {
    setServerError("");
    try {
      // 1. Register the user — creates the account in the DB
      await authApi.register({ full_name, email, role, password });

      // 2. Auto-login so the user lands on the dashboard immediately
      const { access_token } = await authApi.login({ email, password });
      useAuthStore.setState({ token: access_token });
      const user = await authApi.me();
      setSession({ user, token: access_token });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(err.message || "Registration failed. Please try again.");
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
          Create your account
        </h2>
        <p className="text-sm text-muted mt-1.5">
          Sign up to access your TransitOps workspace.
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
        {/* Full Name */}
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          leftIcon={<User />}
          required
          error={errors.full_name?.message}
          {...register("full_name", { required: "Full name is required" })}
        />

        {/* Email */}
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

        {/* Role */}
        <Select
          label="Role"
          placeholder="Select your role"
          options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          required
          error={errors.role?.message}
          {...register("role", { required: "Please select a role" })}
        />

        {/* Password */}
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
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
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-[34px] text-zinc-500 hover:text-zinc-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <Input
            label="Confirm password"
            type={showConfirm ? "text" : "password"}
            placeholder="••••••••"
            leftIcon={<Lock />}
            required
            error={errors.confirm_password?.message}
            {...register("confirm_password", {
              required: "Please confirm your password",
              validate: (val) =>
                val === password || "Passwords do not match",
            })}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-[34px] text-zinc-500 hover:text-zinc-300 transition-colors"
            tabIndex={-1}
          >
            {showConfirm ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          isLoading={isSubmitting}
          rightIcon={<UserPlus />}
        >
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-muted mt-8">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
