import { numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';

interface PrintPaymentRequestProps {
  data: {
    date: string;
    requestNo: string;
    requesterName: string;
    department: string;
    content: string;
    amount: number;
    times: string;
    bankAccount: string;
    bankAccountName: string;
    bankName: string;
    attachments: string;
    unionGroupName?: string;
  };
}

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

export function PrintPaymentRequest({ data }: PrintPaymentRequestProps) {
  const settings = getOrgSettings();
  const d = new Date(data.date);
  const amountWords = data.amount > 0 ? numberToVietnameseWords(data.amount) : 'Không đồng';

  const labelStyle: React.CSSProperties = { margin: '6px 0', lineHeight: '1.7' };

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
          <p style={{ margin: 0 }}>Mẫu: C37-HĐ</p>
        </div>
      </div>

      <div style={{ height: '16px' }}></div>


      <div style={{ height: '16px' }}></div>

      {/* 2. Tiêu đề phiếu */}
      <div style={{ textAlign: 'center', margin: '22px 0 8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, letterSpacing: '0.5px' }}>GIẤY ĐỀ NGHỊ THANH TOÁN</h2>
        <p style={{ fontStyle: 'italic', fontSize: '13px', margin: '6px 0' }}>
          Ngày.....tháng......năm....... 
        </p>
        <p style={{ fontSize: '13px', margin: '3px 0' }}>Số:...............</p>
      </div>

      {/* 3. Kính gửi */}
      <div style={{ textAlign: 'center', margin: '15px 0', fontWeight: 'bold', fontSize: '14px' }}>
        <p style={{ margin: 0 }}>Kính gửi: BCH Công đoàn NHPT Chi nhánh KV Bắc Đông Bắc</p>
      </div>

      {/* 4. Nội dung chính */}
      <div style={{ lineHeight: '1.8', fontSize: '14px' }}>
        <p style={labelStyle}>Họ và tên người đề nghị thanh toán: <span style={{ fontWeight: 500 }}>{data.requesterName || '...................................'}</span></p>
        <p style={labelStyle}>Đơn vị: <span style={{ fontWeight: 500 }}>{data.department || '...................................'}</span></p>
        <p style={labelStyle}>Nội dung thanh toán: <span style={{ fontWeight: 500 }}>{data.content || '...................................'}</span>{data.times ? ` (Lần ${data.times}).` : ''}</p>
        <p style={labelStyle}>
          Số tiền: <span style={{ fontWeight: 'bold' }}>{data.amount > 0 ? `${formatCurrency(data.amount)} đ` : '.................'}</span>
          {' '}Viết bằng chữ: <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}>{amountWords}./.</span>
        </p>
      </div>

      {/* 5. Thông tin chuyển khoản - Căn lề chuẩn theo tt.bmp */}
      {(data.bankAccount || data.bankAccountName || data.bankName) && (
        <div style={{ marginTop: '15px', fontStyle: 'italic', fontSize: '14px', lineHeight: '1.8' }}>
          <p style={{ margin: '4px 0' }}>Thông tin Chuyển khoản:</p>
          <p style={{ margin: '4px 0', paddingLeft: '20px' }}>Số TK: {data.bankAccount || '...............'}</p>
          <p style={{ margin: '4px 0', paddingLeft: '20px' }}>Tên TK: {data.bankAccountName || '...............'}</p>
          <p style={{ margin: '4px 0', paddingLeft: '20px' }}>Tại NH: {data.bankName || '...............'}</p>
        </div>
      )}

      {/* 6. Chứng từ kèm theo */}
      <div style={{ fontStyle: 'italic', margin: '12px 0' }}>
        <p style={{ margin: '4px 0' }}>
          (Kèm theo {data.attachments || '.....'} chứng từ gốc)
        </p>
      </div>

      {/* 7. Chữ ký */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', textAlign: 'center', fontSize: '13px' }}>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Người đề nghị thanh toán</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '65px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{data.requesterName}</p>
        </div>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Kế toán</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '65px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.accountantName}</p>
        </div>
        <div style={{ width: '33%' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>Lãnh đạo đơn vị</p>
          <p style={{ fontSize: '11px', fontStyle: 'italic', margin: '0 0 2px', color: '#666' }}>(Ký, họ tên)</p>
          <p style={{ minHeight: '65px' }}></p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{settings.leaderName || ''}</p>
        </div>
      </div>
    </div>
  );
}
