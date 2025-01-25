import { FunctionComponent, InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input: FunctionComponent<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={clsx(
        "px-3 py-2 bg-white border border-slate-300 placeholder-slate-400",
        "focus:outline-none focus:border-violet-500 focus:ring-violet-500 focus:ring-1",
        "block w-full rounded-md sm:text-sm",
        className
      )}
      {...props}
    />
  );
}