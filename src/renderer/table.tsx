import { FunctionComponent, HTMLAttributes } from "react";
import clsx from "clsx";

interface TableProps extends HTMLAttributes<HTMLTableElement> {}
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}
interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {}
interface TableHeaderCellProps extends HTMLAttributes<HTMLTableCellElement> {}

export const Table: FunctionComponent<TableProps> = ({ className, ...props }) => {
  return (
    <table
      className={clsx(
        "border-collapse table-auto w-full",
        className
      )}
      {...props}
    />
  );
}

const Header: FunctionComponent<TableHeaderProps> = ({ className, ...props }) => {
  return <thead className={clsx(className)} {...props} />;
};

const Body: FunctionComponent<TableBodyProps> = ({ className, ...props }) => {
  return <tbody className={clsx(className)} {...props} />;
};

const Row: FunctionComponent<TableRowProps> = ({ className, ...props }) => {
  return <tr className={clsx(className)} {...props} />;
};

const Cell: FunctionComponent<TableCellProps> = ({ className, ...props }) => {
  return (
    <td
      className={clsx(
        "border-b border-slate-100 p-2",
        className
      )}
      {...props}
    />
  );
};

const HeaderCell: FunctionComponent<TableHeaderCellProps> = ({ className, ...props }) => {
  return (
    <th
      className={clsx(
        "border-b font-medium p-2 text-left",
        className
      )}
      {...props}
    />
}

Table.Header = Header;
Table.Body = Body;
Table.Row = Row;
Table.Cell = Cell;
Table.HeaderCell = HeaderCell;