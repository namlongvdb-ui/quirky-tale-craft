import { useMemo } from 'react';
import { useOrgSettings, useTransactions } from '@/hooks/useFinanceData';
import { useStaffList } from '@/hooks/useStaffData';
import { findStaffInText } from '@/lib/utils';
import { getOrgSettings } from '@/lib/finance-store';

function fmt(n: number) { return n.toLocaleString('vi-VN'); }

export function PrintTrackingReport() {
  const orgSettings = getOrgSettings();
  const { transactions: thamHoiRows } = useTransactions(undefined, 'tham-hoi');
  const { list: staffList } = useStaffList();

  const sortedRows = useMemo(() => {
    return [...thamHoiRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [thamHoiRows]);

  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '6px 8px' };
  const centerCell: React.CSSProperties = { ...cellStyle, textAlign: 'center' };
  const rightCell: React.CSSProperties = { ...cellStyle, textAlign: 'right' };
  const headerStyle: React.CSSProperties = { ...centerCell, fontWeight: 'bold', backgroundColor: '#f0f0f0' };

  const totalAmount = sortedRows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="print-content" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '13px', color: '#000', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ textAlign: 'center', width: '40%' }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: '0' }}>{orgSettings.orgName}</p>
          <p style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: '4px 0' }}>{orgSettings.orgSubName}</p>
          <div style={{ width: '60px', borderBottom: '2px solid #000', margin: '8px auto' }}></div>
        </div>
        <div style={{ textAlign: 'center', width: '50%' }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: '0' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0' }}>Độc lập - Tự do - Hạnh phúc</p>
          <div style={{ width: '150px', borderBottom: '2px solid #000', margin: '8px auto' }}></div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: '0' }}>
          BÁO CÁO THEO DÕI THĂM HỎI ĐOÀN VIÊN
        </p>
        <p style={{ fontSize: '13px', fontStyle: 'italic', marginTop: '8px' }}>
          Ngày xuất báo cáo: {new Date().toLocaleDateString('vi-VN')}
        </p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, width: '40px' }}>STT</th>
            <th style={{ ...headerStyle, width: '100px' }}>Ngày lập</th>
            <th style={{ ...headerStyle, width: '90px' }}>Số hiệu</th>
            <th style={headerStyle}>Lý do / Nội dung chi tiết</th>
            <th style={{ ...headerStyle, width: '180px' }}>Đoàn viên được thăm hỏi</th>
            <th style={{ ...headerStyle, width: '180px' }}>Tổ công đoàn</th>
            <th style={{ ...headerStyle, width: '120px' }}>Số tiền (đ)</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ ...centerCell, padding: '40px', color: '#666' }}>Chưa có dữ liệu thăm hỏi</td>
            </tr>
          ) : (
            sortedRows.map((th, i) => (
              <tr key={th.id}>
                <td style={centerCell}>{i + 1}</td>
                <td style={centerCell}>{new Date(th.date).toLocaleDateString('vi-VN')}</td>
                <td style={centerCell}>{th.voucherNo}</td>
                <td style={cellStyle}>{th.reason || th.description}</td>
                <td style={cellStyle}>{th.recipientName || th.personName}</td>
                <td style={cellStyle}>{th.department || '—'}</td>
                <td style={rightCell}>{fmt(th.amount)}</td>
              </tr>
            ))
          )}
          {sortedRows.length > 0 && (
            <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
              <td colSpan={6} style={rightCell}>TỔNG CỘNG:</td>
              <td style={rightCell}>{fmt(totalAmount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <p style={{ fontWeight: 'bold', margin: '0' }}>NGƯỜI LẬP</p>
          <p style={{ fontStyle: 'italic', fontSize: '11px', margin: '4px 0 60px 0' }}>(Ký, họ tên)</p>
          <p style={{ fontWeight: 'bold', margin: '0' }}>{orgSettings.creatorName}</p>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <p style={{ fontWeight: 'bold', margin: '0' }}>KẾ TOÁN</p>
          <p style={{ fontStyle: 'italic', fontSize: '11px', margin: '4px 0 60px 0' }}>(Ký, họ tên)</p>
          <p style={{ fontWeight: 'bold', margin: '0' }}>{orgSettings.accountantName}</p>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <p style={{ fontWeight: 'bold', margin: '0' }}>LÃNH ĐẠO ĐƠN VỊ</p>
          <p style={{ fontStyle: 'italic', fontSize: '11px', margin: '4px 0 60px 0' }}>(Ký, họ tên)</p>
          <p style={{ fontWeight: 'bold', margin: '0' }}>{orgSettings.leaderName}</p>
        </div>
      </div>
    </div>
  );
}
