import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ACCOUNT_CHART, searchAccounts } from '@/lib/account-chart';

interface AccountCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
}

export function AccountCodeInput({ value, onChange, placeholder, className }: AccountCodeInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ACCOUNT_CHART.filter(a => a.level === 1).slice(0, 15);
    return searchAccounts(search).slice(0, 20);
  }, [search]);

  const selectedAccount = ACCOUNT_CHART.find(a => a.code === value);

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder || 'Nhập mã TK...'}
        className={`h-10 font-mono ${className || ''}`}


        title={selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : ''}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-64 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-auto right-0">
          {filtered.map(acc => (
            <div
              key={acc.code}
              className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors flex items-center gap-2 ${
                value === acc.code ? 'bg-primary/10 text-primary' : ''
              } ${acc.level === 2 ? 'pl-6' : ''}`}
              onMouseDown={() => {
                onChange(acc.code);
                setSearch(acc.code);
                setOpen(false);
              }}
            >
              <span className={`font-mono text-xs w-10 shrink-0 ${acc.level === 1 ? 'font-bold' : 'text-muted-foreground'}`}>
                {acc.code}
              </span>
              <span className="truncate text-xs">{acc.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
