import { numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';

interface PrintVisitVoucherProps {
  data: {
    date: string;
    visitorDepartment: string;
    recipientName: string;
    reason: string;
    amount: number;
    unionGroupName?: string;
  };
}

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

function normalizeText(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function PrintVisitVoucher({ data }: PrintVisitVoucherProps) {
  const settings = getOrgSettings();
  const d = new Date(data.date);
  const amountWords = data.amount > 0 ? numberToVietnameseWords(data.amount) : 'Không đồng';

  // 1. Tìm tên Tổ trưởng của tổ được chọn
  const selectedGroup = settings.unionGroups.find(g => g.name === data.unionGroupName);
  const groupLeaderName = selectedGroup?.leaderName || settings.unionGroups[0]?.leaderName || '';

  // 2. Kiểm tra tổ công đoàn có thuộc địa bàn nào không
  const currentGroupName = normalizeText(data.unionGroupName || '');
  const matchedArea = (settings.areaRepresentatives || []).find(area => {
    const normalizedArea = normalizeText(area.areaName);
    if (!normalizedArea || !currentGroupName) return false;
    return currentGroupName.includes(normalizedArea) || normalizedArea.includes(currentGroupName);
  });
  
  // Nếu thuộc địa bàn → "UV BCH Công đoàn", ngược lại → "Chủ tịch"
  const leftSignatureTitle = matchedArea ? "UV BCH Công đoàn" : "Chủ Tịch";
  const leftSignatureName = matchedArea ? matchedArea.officerName : (settings.leaderName || '');

  const labelStyle: React.CSSProperties = { margin: '8px 0', lineHeight: '1.7' };

  return (
    <div className="print-voucher" style={{ 
      fontFamily: 'Times New Roman, serif', 
      fontSize: '14px', 
      color: '#000', 
      padding: '30px 45px', 
      maxWidth: '720px', 
      margin: '0 auto',
      backgroundColor: '#fff' 
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ textAlign: 'center', width: '60%' }}>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{settings.orgSubName.toUpperCase()}</p>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '2px 0 0', textDecoration: 'underline' }}>
            {(data.unionGroupName || settings.unionGroups[0]?.name || '').toUpperCase()}
          </p>
        </div>
        <div style={{ textAlign: 'center', width: '40%', fontSize: '12px' }}>
          <p style={{ margin: 0 }}>Mẫu: C11-TLĐ</p>
        </div>
      </div>

      <div style={{ height: '16px' }}></div>

      {/* Title */}
      <div style={{ textAlign: 'center', margin: '28px 0 24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>PHIẾU THĂM HỎI</h2>
      </div>

      {/* Content */}
      <div style={{ lineHeight: '1.7', fontSize: '14px' }}>
        <p style={labelStyle}>Họ và tên người thăm hỏi: <span style={{ fontWeight: 500 }}>{data.visitorDepartment || '...................................'}</span></p>
        <p style={labelStyle}>Họ và Tên người được thăm hỏi: <span style={{ fontWeight: 500 }}>{data.recipientName || '...................................'}</span></p>
        <p style={labelStyle}>Lý do thăm hỏi: <span style={{ fontWeight: 500 }}>{data.reason || '...................................'}</span></p>
        <p style={labelStyle}>Số tiền: <span style={{ fontWeight: 'bold' }}>{data.amount > 0 ? `${formatCurrency(data.amount)} đ` : '.................'}</span></p>
        <p style={labelStyle}>Bằng chữ: <span style={{ fontWeight: 'bold' }}>{amountWords}.</span></p>
      </div>

      {/* Date */}
      <div style={{ textAlign: 'right', margin: '24px 0 8px', fontStyle: 'italic', fontSize: '13px' }}>
        <p style={{ margin: 0 }}>.............., Ngày......tháng.......năm........</p>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', textAlign: 'center', fontSize: '13px' }}>
        {/* Bên trái: Thay đổi linh hoạt theo tổ */}
        <div style={{ width: '50%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>TM.BCH CĐ NHPT Chi nhánh</p>
          <p style={{ fontWeight: 'bold', margin: '0 0 2px' }}>{leftSignatureTitle}</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <div style={{ height: '70px' }}></div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{leftSignatureName}</p>
        </div>

        {/* Bên phải: Tổ công đoàn */}
        <div style={{ width: '50%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>TM. Tổ công đoàn</p>
          <p style={{ fontWeight: 'bold', margin: '0 0 2px' }}>Tổ trưởng</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <div style={{ height: '70px' }}></div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{groupLeaderName}</p>
        </div>
      </div>
    </div>
  );
}
