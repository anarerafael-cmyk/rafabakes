"use client";

import { useFormStatus } from "react-dom";

/** A submit button that locks while the form is sending, so a double tap can't submit twice. */
export default function SubmitButton({ children, busyText, className, style }: {
  children: React.ReactNode; busyText: string; className?: string; style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return <button className={className} style={style} disabled={pending}>{pending ? busyText : children}</button>;
}
