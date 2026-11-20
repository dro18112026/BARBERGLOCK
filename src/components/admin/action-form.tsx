"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

/** `message` (optional) replaces the generic success text. */
export type ActionResult = { error: string | null; ok: boolean; message?: string };
export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const initial: ActionResult = { error: null, ok: false };
const PendingContext = createContext(false);

/**
 * A <form> bound to a Server Action that shows its error / success message.
 *
 * Once hydrated, it submits via onSubmit + startTransition (preventDefault
 * stops React's own form action): React resets uncontrolled forms after an
 * `action` completes, which would wipe what the user typed on a validation
 * error. The `action` prop is still set so that a submit *before* hydration is
 * a POST to the Server Action (progressive enhancement) — without it the
 * browser would do a GET and put the fields (e.g. a customer's phone) in the URL.
 */
export function ActionForm({
  action,
  children,
  className,
  successText = "Guardado",
  confirmText,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  successText?: string;
  /** If set, asks for confirmation before submitting (destructive actions). */
  confirmText?: string;
  /** Clear the fields after a successful submit (for "add" forms). */
  resetOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={dispatch}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <PendingContext value={pending}>{children}</PendingContext>
      {state.error && (
        <p role="alert" className="w-full basis-full font-bold text-barber">
          {state.error}
        </p>
      )}
      {state.ok && (state.message || successText) && (
        <p role="status" className="w-full basis-full font-bold text-steel">
          {state.message || successText}
        </p>
      )}
    </form>
  );
}

/** Submit button that disables itself while its ActionForm is pending. */
export function SubmitButton({
  children,
  pendingText = "Guardando…",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
