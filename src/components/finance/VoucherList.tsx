import { TransactionList } from './TransactionList';
import { Transaction } from '@/types/finance';

interface VoucherListProps {
  type: 'thu' | 'chi';
  onChanged?: () => void;
  refreshKey?: number;
  onSelectForEdit?: (tx: Transaction) => void;
  containerClassName?: string;
}

export function VoucherList({ type, onChanged, refreshKey, onSelectForEdit, containerClassName }: VoucherListProps) {
  const title = type === 'thu' ? 'PHIẾU THU' : 'PHIẾU CHI';
  const personLabel = type === 'thu' ? 'Người nộp' : 'Người nhận';

  return (
    <TransactionList
      type={type}
      title={title}
      personLabel={personLabel}
      onChanged={onChanged}
      refreshKey={refreshKey}
      onSelectForEdit={onSelectForEdit}
      containerClassName={containerClassName}
    />
  );
}
