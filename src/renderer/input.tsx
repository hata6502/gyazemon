import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = ({ className = "", ...props }: InputProps) => {
  return (
    <input
      className={`px-3 py-2 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-violet-500 block w-full rounded-md sm:text-sm focus:ring-1 ${className}`}
      {...props}
    />
  );
}