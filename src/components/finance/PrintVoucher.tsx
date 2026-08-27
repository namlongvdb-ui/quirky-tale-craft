import { numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';

interface SignatureDisplay {
  signer_name: string;
  role: string;
  signed_at: string;
}

interface PrintVoucherProps {
  type: 'thu' | 'chi';
  data: {
    date: string;
    voucherNo: string;
    amount: number;
    description: string;
    personName: string;
    department: string;
    accountCode: string;
    approver: string;
    attachments: number;
  };
  signatures?: SignatureDisplay[];
}

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

export function PrintVoucher({ type, data, signatures = [] }: PrintVoucherProps) {
  const settings = getOrgSettings();
  const title = type === 'thu' ? 'PHIẾU THU' : 'PHIẾU CHI';
  const personLabel = type === 'thu' ? 'Họ và tên người nộp tiền' : 'Họ và tên người nhận tiền';
  const { day, month, year } = formatDateParts(data.date);
  const amountWords = data.amount > 0 ? numberToVietnameseWords(data.amount) : 'Không đồng';

  const labelStyle: React.CSSProperties = { margin: '6px 0', lineHeight: '1.6' };
  const valueStyle: React.CSSProperties = { fontWeight: 500 };

  return (
    <div className="print-voucher" style={{ fontFamily: 'Times New Roman, serif', fontSize: '14px', color: '#000', padding: '30px 45px', maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ textAlign: 'center', width: '60%' }}>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{settings.orgName.toUpperCase()}</p>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '2px 0 0', textDecoration: 'underline' }}>{settings.orgSubName.toUpperCase()}</p>
        </div>
        <div style={{ textAlign: 'right', width: '40%', fontSize: '12px' }}>
          <p style={{ margin: 0 }}>Mẫu số: C41-BB</p>
        </div>
      </div>

      <div style={{ height: '16px' }}></div>

      {/* Title */}
      <div style={{ textAlign: 'center', margin: '18px 0 8px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>{title}</h2>
        <p style={{ fontSize: '13px', margin: '4px 0', fontStyle: 'italic' }}>
          Ngày.......tháng.......năm.......
        </p>
        <p style={{ fontSize: '13px', margin: '2px 0' }}>Số CT:........{/* {data.voucherNo}*/}</p>
      </div>

      {/* Content */}
      <div style={{ lineHeight: '1.7', fontSize: '14px' }}>
        <p style={labelStyle}>{personLabel}: <span style={valueStyle}>{data.personName || '...................................'}</span></p>
        <p style={labelStyle}>Đơn vị: <span style={valueStyle}>{data.department || '...................................'}</span></p>
        <p style={labelStyle}>Nội dung: <span style={valueStyle}>{data.description || '...................................'}</span></p>
        <p style={labelStyle}>Số tiền: <span style={{ fontWeight: 'bold' }}>{data.amount > 0 ? `${formatCurrency(data.amount)} VNĐ` : '0 VNĐ'}</span></p>
        <p style={labelStyle}>Viết bằng chữ: <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}>{amountWords}</span></p>
        <p style={labelStyle}>Chứng từ kèm theo: ................ là chứng từ gốc</p>
      </div>

      {/* Signatures - Top */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', textAlign: 'center', fontSize: '13px' }}>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>LÃNH ĐẠO ĐƠN VỊ</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.leaderName}</p>
          {signatures.filter(s => s.role === 'lanh_dao').map((sig, idx) => (
            <p key={idx} style={{ fontSize: '10px', color: '#0a7', margin: '4px 0 0' }}>
              ✅ Đã ký số: {new Date(sig.signed_at).toLocaleString('vi-VN')}
            </p>
          ))}
        </div>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>KẾ TOÁN</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.accountantName}</p>
          {signatures.filter(s => s.role === 'ke_toan').map((sig, idx) => (
            <p key={idx} style={{ fontSize: '10px', color: '#0a7', margin: '4px 0 0' }}>
              ✅ Đã ký số: {new Date(sig.signed_at).toLocaleString('vi-VN')}
            </p>
          ))}
        </div>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>NGƯỜI LẬP</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.creatorName}</p>
          {signatures.filter(s => s.role === 'nguoi_lap').map((sig, idx) => (
            <p key={idx} style={{ fontSize: '10px', color: '#0a7', margin: '4px 0 0' }}>
              ✅ Đã ký số: {new Date(sig.signed_at).toLocaleString('vi-VN')}
            </p>
          ))}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '28px 0' }} />

      {/* Receipt section */}
      <p style={{ margin: '6px 0' }}>Đã nhận đủ số tiền: <span style={{ fontWeight: 'bold' }}>{data.amount > 0 ? `${formatCurrency(data.amount)} VNĐ` : '0 VNĐ'}</span></p>
      <p style={{ margin: '6px 0' }}>Viết bằng chữ: <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}>{amountWords}</span></p>

      <div style={{ textAlign: 'right', margin: '18px 0', fontStyle: 'italic', fontSize: '13px' }}>
        .............,Ngày.....tháng......năm.......
      </div>

      {/* Signatures - Bottom */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', textAlign: 'center', fontSize: '13px' }}>
        <div style={{ width: '50%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>THỦ QUỸ</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.treasurerName}</p>
        </div>
        <div style={{ width: '50%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Người {type === 'thu' ? 'nộp' : 'nhận'} tiền</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '55px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{data.personName}</p>
        </div>
      </div>
    </div>
  );
}
