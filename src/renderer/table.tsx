import { FunctionComponent, HTMLAttributes } from "react";
import clsx from "clsx";

interface TableProps extends HTMLAttributes<HTMLTableElement> {}
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}
interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {}
interface TableHeaderCellProps extends HTMLAttributes<HTMLTableCellElement> {}

export const Table: FunctionComponent<TableProps> = ({
  className,
  ...props
}) => (
  <table
    className={clsx("border-collapse table-auto w-full", className)}
    {...props}
  />
);

export const TableHeader: FunctionComponent<TableHeaderProps> = ({
  className,
  ...props
}) => <thead className={clsx(className)} {...props} />;

export const TableBody: FunctionComponent<TableBodyProps> = ({
  className,
  ...props
}) => <tbody className={clsx(className)} {...props} />;

export const TableRow: FunctionComponent<TableRowProps> = ({
  className,
  ...props
}) => <tr className={clsx(className)} {...props} />;

export const TableCell: FunctionComponent<TableCellProps> = ({
  className,
  ...props
}) => (
  <td className={clsx("border-b border-slate-100 p-2", className)} {...props} />
);

export const TableHeaderCell: FunctionComponent<TableHeaderCellProps> = ({
  className,
  ...props
}) => (
  <th
    className={clsx("border-b font-medium p-2 text-left", className)}
    {...props}
  />
);
