import { FunctionComponent, HTMLAttributes } from "react";
import clsx from "clsx";

interface TextProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "body" | "label";
}

export const Text: FunctionComponent<TextProps> = ({ variant = "body", className, ...props }) => {
  return (
    <div
      className={clsx(
        "text-slate-700 text-sm",
        {
          "block font-medium": variant === "label"
        },
        className
      )}
      {...props}
    />
  );
}