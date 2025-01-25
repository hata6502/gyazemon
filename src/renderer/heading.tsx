import { createElement, HTMLAttributes } from "react";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const Heading = ({ level = 1, className = "", ...props }: HeadingProps) => {
  const baseClasses = "font-medium text-slate-700";
  const sizeClasses = {
    1: "text-3xl",
    2: "text-2xl",
    3: "text-xl",
    4: "text-lg",
    5: "text-base",
    6: "text-sm"
  };

  return createElement(
    `h${level}`,
    {
      className: `${baseClasses} ${sizeClasses[level]} ${className}`,
      ...props
    }
  );
}