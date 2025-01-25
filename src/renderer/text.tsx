import { FunctionComponent, HTMLAttributes } from "react";

interface TextProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "body" | "label";
}

export const Text: FunctionComponent<TextProps> = ({ variant = "body", className = "", ...props }) => {
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