import { ButtonHTMLAttributes, FunctionComponent } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "icon";
}

export const Button: FunctionComponent<ButtonProps> = ({ variant = "secondary", className = "", ...props }) => {
  const baseClasses = "px-4 py-2 rounded font-medium focus:outline-none focus:ring-2 transition-colors";
  const variantClasses = {
    primary: "bg-violet-500 text-white hover:bg-violet-600 focus:ring-violet-300 active:bg-violet-700",
    secondary: "bg-white text-slate-700 hover:bg-gray-100 focus:ring-gray-300 active:bg-gray-200",
    icon: "p-2 rounded-full bg-white hover:bg-gray-100 focus:ring-0 active:bg-gray-200"
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}