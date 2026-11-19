"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

/** Модальное окно на <dialog>: фокус, Esc и затемнение из коробки. На телефоне — снизу листом. */
export function Modal({
  open,
  onClose,
  title,
  children,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl border border-border bg-elevated p-0 text-text shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-rise sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="pb-safe p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="-m-2 rounded-xl p-2 text-muted hover:bg-card hover:text-text">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} closeLabel={cancelLabel}>
      <p className="text-muted">{text}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
