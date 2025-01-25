import { HTMLAttributes } from "react";

interface TextProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "body" | "label";
}

export const Text = ({ variant = "body", className = "", ...props }: TextProps) => {
  const variantClasses = {
    body: "text-slate-700 text-sm",
    label: "block font-medium text-slate-700 text-sm"
  };

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}