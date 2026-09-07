import { getTransactions, getOrgSettings } from '@/lib/finance-store';
import { useMemo } from 'react';

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}

const typeLabels: Record<string, string> = {
  thu: 'PT',
  chi: 'PC',
  'tham-hoi': 'TH',
  'de-nghi': 'DN',
};

export function PrintDetailLedger({ refreshKey }: { refreshKey?: number }) {
  const settings = getOrgSettings();
  const rows = useMemo(() => {
    return getTransactions().sort((a, b) => a.date.localeCompare(b.date));
  }, [refreshKey]);

  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px 6px', fontSize: '11px', verticalAlign: 'middle' };
  const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 'bold', textAlign: 'center', background: '#f5f5f5', padding: '5px 6px' };
  const rightCell: React.CSSProperties = { ...cellStyle, textAlign: 'right' };
  const centerCell: React.CSSProperties = { ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' };

  return (
    <div className="print-voucher" style={{ fontFamily: 'Times New Roman, serif', fontSize: '12px', color: '#000', padding: '20px 25px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ textAlign: 'center', width: '60%' }}>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{settings.orgName.toUpperCase()}</p>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '2px 0 0', textDecoration: 'underline' }}>{settings.orgSubName.toUpperCase()}</p>
        </div>
        <div style={{ textAlign: 'right', width: '40%', fontSize: '12px' }}>
        </div>
      </div>

      <div style={{ height: '16px' }}></div>
      <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 'bold', margin: '12px 0 16px', letterSpacing: '1px' }}>SỔ CHI TIẾT</h2>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headerCellStyle}>Ngày CT</th>
            <th style={headerCellStyle}>Số CT</th>
            <th style={headerCellStyle}>Số tiền</th>
            <th style={headerCellStyle}>Nội dung</th>
            <th style={headerCellStyle}>Loại</th>
            <th style={headerCellStyle}>Thu</th>
            <th style={headerCellStyle}>Chi</th>
            <th style={headerCellStyle}>TK Nợ</th>
            <th style={headerCellStyle}>TK Có</th>
            <th style={headerCellStyle}>Họ tên</th>
            <th style={headerCellStyle}>Đơn vị</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td style={centerCell}>{formatDate(row.date)}</td>
              <td style={centerCell}>{row.voucherNo}</td>
              <td style={rightCell}>{formatCurrency(row.amount)}</td>
              <td style={cellStyle}>{row.description}</td>
              <td style={centerCell}>{typeLabels[row.type] || row.type}</td>
              <td style={rightCell}>{row.type === 'thu' ? formatCurrency(row.amount) : ''}</td>
              <td style={rightCell}>{row.type === 'chi' ? formatCurrency(row.amount) : ''}</td>
              <td style={centerCell}>{row.type === 'thu' ? '111' : (row.accountCode || '')}</td>
              <td style={centerCell}>{row.type === 'chi' ? '111' : (row.accountCode || '')}</td>
              <td style={cellStyle}>{row.personName}</td>
              <td style={cellStyle}>{row.department}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={cellStyle} colSpan={11}>Chưa có dữ liệu</td>
            </tr>
          )}
        </tbody>
      </table>

      <p style={{ textAlign: 'right', fontStyle: 'italic', margin: '18px 0 8px', fontSize: '13px' }}>
        Ngày........ tháng........ năm........
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', textAlign: 'center', fontSize: '13px' }}>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Người lập</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.creatorName}</p>
        </div>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Kế toán</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.accountantName}</p>
        </div>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Lãnh đạo đơn vị</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên, đóng dấu)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.leaderName}</p>
        </div>
      </div>
    </div>
  );
}
