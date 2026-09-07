import { getTransactions, getOpeningBalance, getOrgSettings } from '@/lib/finance-store';
import { useMemo } from 'react';

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}

export function PrintCashBook({ refreshKey }: { refreshKey?: number }) {
  const settings = getOrgSettings();
  const data = useMemo(() => {
    const txs = getTransactions();
    const opening = getOpeningBalance();
    let balance = opening;
    const rows = txs
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(tx => {
        const thu = tx.type === 'thu' ? tx.amount : 0;
        const chi = tx.type === 'chi' ? tx.amount : 0;
        balance = balance + thu - chi;
        return { ...tx, thu, chi, balance };
      });
    const totalThu = rows.reduce((s, r) => s + r.thu, 0);
    const totalChi = rows.reduce((s, r) => s + r.chi, 0);
    return { rows, opening, totalThu, totalChi, closing: opening + totalThu - totalChi };
  }, [refreshKey]);

  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '5px 8px', fontSize: '12px', verticalAlign: 'middle' };
  const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 'bold', textAlign: 'center', background: '#f5f5f5', padding: '6px 8px' };
  const rightCell: React.CSSProperties = { ...cellStyle, textAlign: 'right' };

  return (
    <div className="print-voucher" style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px', color: '#000', padding: '25px 35px' }}>
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

      <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 'bold', margin: '12px 0 4px', letterSpacing: '1px' }}>SỔ QUỸ TIỀN MẶT</h2>
      <p style={{ textAlign: 'right', fontSize: '11px', margin: '0 0 10px' }}>ĐVT: đồng</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headerCellStyle} rowSpan={2}>Ngày CT</th>
            <th style={headerCellStyle} rowSpan={2}>Số CT</th>
            <th style={headerCellStyle} rowSpan={2}>Nội dung</th>
            <th style={headerCellStyle} colSpan={2}>Số tiền</th>
            <th style={headerCellStyle} rowSpan={2}>Tồn</th>
          </tr>
          <tr>
            <th style={headerCellStyle}>Thu</th>
            <th style={headerCellStyle}>Chi</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cellStyle} colSpan={3}><b>Số dư đầu kỳ</b></td>
            <td style={rightCell}></td>
            <td style={rightCell}></td>
            <td style={{ ...rightCell, fontWeight: 'bold' }}>{formatCurrency(data.opening)}</td>
          </tr>
          {data.rows.map(row => (
            <tr key={row.id}>
              <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>{formatDate(row.date)}</td>
              <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.voucherNo}</td>
              <td style={cellStyle}>{row.description}</td>
              <td style={rightCell}>{row.thu > 0 ? formatCurrency(row.thu) : ''}</td>
              <td style={rightCell}>{row.chi > 0 ? formatCurrency(row.chi) : ''}</td>
              <td style={rightCell}>{formatCurrency(row.balance)}</td>
            </tr>
          ))}
          <tr>
            <td style={cellStyle} colSpan={3}><b>Tổng phát sinh</b></td>
            <td style={{ ...rightCell, fontWeight: 'bold' }}>{formatCurrency(data.totalThu)}</td>
            <td style={{ ...rightCell, fontWeight: 'bold' }}>{formatCurrency(data.totalChi)}</td>
            <td style={rightCell}></td>
          </tr>
          <tr>
            <td style={cellStyle} colSpan={3}><b>Số dư cuối kỳ</b></td>
            <td style={rightCell}></td>
            <td style={rightCell}></td>
            <td style={{ ...rightCell, fontWeight: 'bold', fontSize: '14px' }}>{formatCurrency(data.closing)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ textAlign: 'right', fontStyle: 'italic', margin: '18px 0 8px', fontSize: '13px' }}>
        Ngày........ tháng........ năm........
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', textAlign: 'center', fontSize: '13px' }}>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Thủ Quỹ</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.treasurerName}</p>
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
