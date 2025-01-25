import { HTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {}
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}
interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {}
interface TableHeaderCellProps extends HTMLAttributes<HTMLTableCellElement> {}

export const Table = ({ className = "", ...props }: TableProps) => {
  return (
    <table className={`border-collapse table-auto w-full ${className}`} {...props} />
  );
}

const Header = ({ className = "", ...props }: TableHeaderProps) => {
  return <thead className={className} {...props} />;
};

const Body = ({ className = "", ...props }: TableBodyProps) => {
  return <tbody className={className} {...props} />;
};

const Row = ({ className = "", ...props }: TableRowProps) => {
  return <tr className={className} {...props} />;
};

const Cell = ({ className = "", ...props }: TableCellProps) => {
  return <td className={`border-b border-slate-100 p-2 ${className}`} {...props} />;
};

const HeaderCell = ({ className = "", ...props }: TableHeaderCellProps) => {
  return <th className={`border-b font-medium p-2 text-left ${className}`} {...props} />;
}

Table.Header = Header;
Table.Body = Body;
Table.Row = Row;
Table.Cell = Cell;
Table.HeaderCell = HeaderCell;