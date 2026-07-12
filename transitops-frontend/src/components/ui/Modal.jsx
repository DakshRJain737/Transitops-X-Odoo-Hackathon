import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

/**
 * Modal — powers every overlay in the app:
 *  - variant="dialog" → centered, for Add Vehicle, Add Driver, Create Trip, confirmations
 *  - variant="drawer" → slides in from the right, for Edit Vehicle/Driver drawers
 *
 * Handles, once, so no page has to re-implement it:
 *  - Escape key to close
 *  - Click-on-backdrop to close (click inside content does NOT close)
 *  - Body scroll lock while open
 *  - Enter/exit animation via AnimatePresence (parent must keep this mounted
 *    and control visibility via the `isOpen` prop — do not conditionally
 *    render <Modal> itself, or exit animations won't play)
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  variant = "dialog",
  size = "md",
  showCloseButton = true,
}) {
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />

          {variant === "drawer" ? (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "absolute right-0 top-0 h-full w-full glass border-l border-white/[0.08] shadow-2xl overflow-y-auto",
                sizeClass
              )}
            >
              <ModalChrome
                title={title}
                description={description}
                onClose={onClose}
                showCloseButton={showCloseButton}
              >
                {children}
              </ModalChrome>
            </motion.div>
          ) : (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "relative w-full mx-4 glass rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto",
                sizeClass
              )}
            >
              <ModalChrome
                title={title}
                description={description}
                onClose={onClose}
                showCloseButton={showCloseButton}
              >
                {children}
              </ModalChrome>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function ModalChrome({ title, description, onClose, showCloseButton, children }) {
  return (
    <>
      {(title || showCloseButton) && (
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border-subtle">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted mt-1">{description}</p>
            )}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {children}
    </>
  );
}

/* ---- Compound sub-components for consistent internal spacing ---- */
export function ModalBody({ children, className }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function ModalFooter({ children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-white/[0.015]",
        className
      )}
    >
      {children}
    </div>
  );
}

Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

/**
 * ConfirmDialog — pre-built confirmation modal for destructive/important actions:
 * Delete Vehicle, Cancel Trip, Deactivate User, etc. Saves every page from
 * hand-rolling the same "Are you sure?" pattern.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <Modal.Body>
        <div className="flex gap-4">
          <div
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              variant === "danger"
                ? "bg-danger-bg text-danger-400"
                : "bg-accent-500/12 text-accent-400"
            )}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-50">{title}</h3>
            <p className="text-sm text-muted mt-1">{description}</p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default Modal;