import { ButtonHTMLAttributes, FunctionComponent } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "icon";
}

export const Button: FunctionComponent<ButtonProps> = ({
  variant = "secondary",
  className,
  ...props
}) => (
  <button
    className={clsx(
      variant === "icon" ? "p-2 rounded-full" : "px-4 py-2 rounded",
      "font-medium focus:outline-none focus:ring-2 transition-colors",
      {
        "bg-violet-500 text-white hover:bg-violet-600 focus:ring-violet-300 active:bg-violet-700":
          variant === "primary",
        "bg-white text-slate-700 hover:bg-gray-100 focus:ring-gray-300 active:bg-gray-200":
          variant === "secondary",
        "bg-white hover:bg-gray-100 focus:ring-0 active:bg-gray-200":
          variant === "icon",
      },
      className
    )}
    {...props}
  />
);
