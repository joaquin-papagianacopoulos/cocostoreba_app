"use client";

import { startTransition } from "react";

/**
 * Form que llama a una acción de useActionState sin que React resetee los campos
 * (con `action={...}` React 19 limpia el form al terminar y se pierde lo cargado si hubo error).
 */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
}) {
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {children}
    </form>
  );
}

export function FieldError({ errors, name }: { errors?: Record<string, string>; name: string }) {
  const message = errors?.[name];
  if (!message) return null;
  return <span className="text-xs font-normal text-red-600 dark:text-red-400">{message}</span>;
}
