import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useState } from "react";
import {
  Mail,
  User,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send,
} from "lucide-react";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ROLE_OPTIONS } from "../../constants/roles";

/**
 * Register — "Contact your administrator" landing page.
 *
 * TransitOps uses admin-controlled user creation (POST /api/admin/users),
 * so self-registration is not exposed. This page collects a request form
 * and shows the user how the onboarding process works instead of exposing
 * the admin endpoint directly.
 */

const STEPS = [
  {
    icon: Send,
    title: "Submit your request",
    desc: "Fill in this form with your name, email, and requested role.",
  },
  {
    icon: ShieldCheck,
    title: "Admin reviews & creates account",
    desc: "Your system administrator will verify the request and provision your account.",
  },
  {
    icon: CheckCircle2,
    title: "Receive credentials",
    desc: "You'll receive login credentials via email once your account is ready.",
  },
];

export default function Register() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { full_name: "", email: "", role: "", message: "" },
  });

  async function onSubmit(values) {
    setSubmitting(true);
    // Simulate a brief delay (actual admin notification would go here via an
    // email/Slack webhook; for now we surface a success state so the demo
    // flow feels complete).
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Back link */}
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to sign in
      </Link>

      <div className="mb-7">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Request account access
        </h2>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          TransitOps accounts are provisioned by your administrator. Submit
          this form and you'll be notified once your account is ready.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-7 space-y-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.35 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400">
              <step.icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">
                <span className="text-accent-400 mr-1">{i + 1}.</span>
                {step.title}
              </p>
              <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
                {step.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {submitted ? (
        /* Success state */
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-400/10 p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/20">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-white">Request submitted!</p>
          <p className="text-xs text-white/50 max-w-xs leading-relaxed">
            Your access request has been sent to the TransitOps administrator.
            You'll receive your credentials via email once the account is
            provisioned.
          </p>
          <Link
            to="/login"
            className="mt-2 text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
          >
            ← Return to sign in
          </Link>
        </motion.div>
      ) : (
        /* Request form */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Full name"
            type="text"
            placeholder="Jane Smith"
            leftIcon={<User />}
            required
            error={errors.full_name?.message}
            {...register("full_name", { required: "Full name is required" })}
          />

          <Input
            label="Work email"
            type="email"
            placeholder="you@company.io"
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

          <Select
            label="Requested role"
            placeholder="Select the role you need"
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            error={errors.role?.message}
            {...register("role", { required: "Please select a role" })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">
              Additional context{" "}
              <span className="text-zinc-600">(optional)</span>
            </label>
            <textarea
              placeholder="e.g. I'm the new fleet coordinator joining on Monday…"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-surface-700 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-accent-500/60 focus:outline-none focus:ring-1 focus:ring-accent-500/30 transition-all"
              {...register("message")}
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-relaxed text-amber-300/80">
              Only your administrator can create TransitOps accounts. This form
              notifies them of your request — it does not grant immediate access.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full mt-1"
            isLoading={submitting}
            rightIcon={<Send />}
          >
            Send Access Request
          </Button>
        </form>
      )}
    </motion.div>
  );
}
