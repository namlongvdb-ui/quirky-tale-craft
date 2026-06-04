import { Fragment, useMemo } from 'react';
import { StaffMember } from '@/types/finance';
import { getStaffList, getStaffSettings, calculateInsuranceSalary, calculateUnionFee } from '@/lib/staff-store';
import { getOrgSettings } from '@/lib/finance-store';

const POSITION_RANK: Record<string, number> = {
  'giám đốc': 1, 'phó giám đốc': 2,
  'trưởng phòng': 3, 'phó trưởng phòng': 4, 'phó phòng': 4,
  'trưởng ban': 3, 'phó trưởng ban': 4,
  'chủ tịch': 1, 'phó chủ tịch': 2,
  'tổ trưởng': 5, 'phó tổ trưởng': 6,
  'chuyên viên chính': 7, 'chuyên viên': 8,
  'cán sự': 9, 'nhân viên': 10,
  'kế toán trưởng': 3, 'kế toán': 8,
};

function getPositionRank(position: string): number {
  const lower = position.toLowerCase().trim();
  for (const [key, rank] of Object.entries(POSITION_RANK)) {
    if (lower.includes(key)) return rank;
  }
  return 99;
}

function fmt(n: number) { return n.toLocaleString('vi-VN'); }

function groupAndSort(list: StaffMember[]) {
  const map: Record<string, StaffMember[]> = {};
  for (const s of list) {
    const dept = s.department || 'Chưa phân tổ';
    if (!map[dept]) map[dept] = [];
    map[dept].push(s);
  }
  for (const dept of Object.keys(map)) {
    map[dept].sort((a, b) => getPositionRank(a.position) - getPositionRank(b.position));
  }
  return map;
}

export function PrintStaffList() {
  const orgSettings = getOrgSettings();
  const settings = getStaffSettings();
  const list = getStaffList();
  const grouped = useMemo(() => groupAndSort(list), [list]);
  const deptNames = Object.keys(grouped).sort();

  const totalFee = list.reduce((sum, s) => {
    const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
    return sum + calculateUnionFee(lbh, settings.baseSalary);
  }, 0);

  let stt = 0;
  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '3px 5px' };
  const rightCell: React.CSSProperties = { ...cellStyle, textAlign: 'right' };
  const centerCell: React.CSSProperties = { ...cellStyle, textAlign: 'center' };

  return (
    <div className="print-content" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12px', color: '#000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{orgSettings.orgName}</p>
          <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{orgSettings.orgSubName}</p>
          <div style={{ width: '60px', borderBottom: '2px solid #000', margin: '6px auto' }}></div>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p style={{ fontSize: '12px', fontWeight: 'bold' }}>Độc lập - Tự do - Hạnh phúc</p>
          <div style={{ width: '120px', borderBottom: '2px solid #000', margin: '6px auto' }}></div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
          DANH SÁCH ĐOÀN VIÊN CÔNG ĐOÀN
        </p>
        <p style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>(Sắp xếp theo Tổ Công đoàn)</p>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '11px' }}>
        <span>Lương cơ sở: <strong>{fmt(settings.baseSalary)} đ</strong></span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            {['STT', 'Họ và tên', 'Chức vụ', 'Ngày sinh', 'GT', 'HS lương', 'HS CV', 'Lương vùng', 'Lương BH', 'Đoàn phí CĐ'].map((h, i) => (
              <th key={i} style={{ ...centerCell, fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: '11px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deptNames.map(dept => {
            const members = grouped[dept];
            const deptFee = members.reduce((sum, s) => {
              const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
              return sum + calculateUnionFee(lbh, settings.baseSalary);
            }, 0);
            return (
              <tbody key={dept}>
                <tr>
                  <td colSpan={10} style={{ ...cellStyle, fontWeight: 'bold', backgroundColor: '#e8e8e8', fontSize: '11px' }}>
                    {dept}
                  </td>
                </tr>
                {members.map(s => {
                  stt++;
                  const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
                  const fee = calculateUnionFee(lbh, settings.baseSalary);
                  return (
                    <tr key={s.id}>
                      <td style={centerCell}>{stt}</td>
                      <td style={cellStyle}>{s.fullName}</td>
                      <td style={cellStyle}>{s.position}</td>
                      <td style={centerCell}>{s.birthDate ? new Date(s.birthDate).toLocaleDateString('vi-VN') : ''}</td>
                      <td style={centerCell}>{s.gender === 'nam' ? 'Nam' : 'Nữ'}</td>
                      <td style={rightCell}>{s.salaryCoefficient.toFixed(2)}</td>
                      <td style={rightCell}>{s.positionCoefficient.toFixed(2)}</td>
                      <td style={rightCell}>{fmt(s.regionalSalary)}</td>
                      <td style={rightCell}>{fmt(Math.round(lbh))}</td>
                      <td style={rightCell}>{fmt(Math.round(fee))}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={8} style={{ ...rightCell, fontWeight: 'bold', fontStyle: 'italic', fontSize: '10px' }}>
                    Cộng {dept}: {members.length} đoàn viên
                  </td>
                  <td style={{ ...rightCell, fontWeight: 'bold' }}>
                    {fmt(Math.round(members.reduce((s, m) => s + calculateInsuranceSalary(m.salaryCoefficient, m.positionCoefficient, m.regionalSalary, settings.baseSalary), 0)))}
                  </td>
                  <td style={{ ...rightCell, fontWeight: 'bold' }}>{fmt(Math.round(deptFee))}</td>
                </tr>
              </tbody>
            );
          })}
          <tr>
            <td colSpan={8} style={{ ...rightCell, fontWeight: 'bold', fontSize: '12px' }}>
              TỔNG CỘNG: {list.length} đoàn viên
            </td>
            <td style={{ ...rightCell, fontWeight: 'bold', fontSize: '12px' }}>
              {fmt(Math.round(list.reduce((s, m) => s + calculateInsuranceSalary(m.salaryCoefficient, m.positionCoefficient, m.regionalSalary, settings.baseSalary), 0)))}
            </td>
            <td style={{ ...rightCell, fontWeight: 'bold', fontSize: '12px' }}>{fmt(Math.round(totalFee))}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '12px' }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <p style={{ fontWeight: 'bold' }}>NGƯỜI LẬP</p>
          <p style={{ fontStyle: 'italic', fontSize: '10px' }}>(Ký, họ tên)</p>
          <div style={{ height: '50px' }}></div>
          <p style={{ fontWeight: 'bold' }}>{orgSettings.accountantName}</p>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <p style={{ fontWeight: 'bold' }}>LÃNH ĐẠO ĐƠN VỊ</p>
          <p style={{ fontStyle: 'italic', fontSize: '10px' }}>(Ký, họ tên)</p>
          <div style={{ height: '50px' }}></div>
          <p style={{ fontWeight: 'bold' }}>{orgSettings.leaderName}</p>
        </div>
      </div>
    </div>
  );
}

interface PrintMonthlyFeeProps {
  month: number;
  year: number;
}

export function PrintMonthlyFee({ month, year }: PrintMonthlyFeeProps) {
  const orgSettings = getOrgSettings();
  const settings = getStaffSettings();
  const list = getStaffList();
  const grouped = useMemo(() => groupAndSort(list), [list]);
  const deptNames = Object.keys(grouped).sort();

  const totalFee = list.reduce((sum, s) => {
    const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
    return sum + calculateUnionFee(lbh, settings.baseSalary);
  }, 0);

  let stt = 0;
  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '3px 5px' };
  const rightCell: React.CSSProperties = { ...cellStyle, textAlign: 'right' };
  const centerCell: React.CSSProperties = { ...cellStyle, textAlign: 'center' };

  return (
    <div className="print-content" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12px', color: '#000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{orgSettings.orgName}</p>
          <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{orgSettings.orgSubName}</p>
          <div style={{ width: '60px', borderBottom: '2px solid #000', margin: '6px auto' }}></div>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p style={{ fontSize: '12px', fontWeight: 'bold' }}>Độc lập - Tự do - Hạnh phúc</p>
          <div style={{ width: '120px', borderBottom: '2px solid #000', margin: '6px auto' }}></div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
          DANH SÁCH THU ĐOÀN PHÍ CÔNG ĐOÀN
        </p>
        <p style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }}>
          Tháng {String(month).padStart(2, '0')} năm {year}
        </p>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '11px' }}>
        <span>Lương cơ sở: <strong>{fmt(settings.baseSalary)} đ</strong></span>
        <span style={{ margin: '0 10px' }}>|</span>
        <span>Trần đoàn phí: <strong>{fmt(Math.round(settings.baseSalary * 0.1))} đ</strong></span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            {['STT', 'Họ và tên', 'Chức vụ', 'HS lương', 'HS CV', 'Lương vùng', 'Lương BH', 'Đoàn phí (0,5%)', 'Ký nhận'].map((h, i) => (
              <th key={i} style={{ ...centerCell, fontWeight: 'bold', backgroundColor: '#f0f0f0', fontSize: '11px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deptNames.map(dept => {
            const members = grouped[dept];
            const deptFee = members.reduce((sum, s) => {
              const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
              return sum + calculateUnionFee(lbh, settings.baseSalary);
            }, 0);
            return (
              <tbody key={dept}>
                <tr>
                  <td colSpan={9} style={{ ...cellStyle, fontWeight: 'bold', backgroundColor: '#e8e8e8', fontSize: '11px' }}>
                    {dept}
                  </td>
                </tr>
                {members.map(s => {
                  stt++;
                  const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
                  const fee = calculateUnionFee(lbh, settings.baseSalary);
                  return (
                    <tr key={s.id}>
                      <td style={centerCell}>{stt}</td>
                      <td style={cellStyle}>{s.fullName}</td>
                      <td style={cellStyle}>{s.position}</td>
                      <td style={rightCell}>{s.salaryCoefficient.toFixed(2)}</td>
                      <td style={rightCell}>{s.positionCoefficient.toFixed(2)}</td>
                      <td style={rightCell}>{fmt(s.regionalSalary)}</td>
                      <td style={rightCell}>{fmt(Math.round(lbh))}</td>
                      <td style={rightCell}>{fmt(Math.round(fee))}</td>
                      <td style={{ ...cellStyle, width: '80px' }}></td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={6} style={{ ...rightCell, fontWeight: 'bold', fontStyle: 'italic', fontSize: '10px' }}>
                    Cộng {dept}: {members.length} đoàn viên
                  </td>
                  <td style={{ ...rightCell, fontWeight: 'bold' }}>
                    {fmt(Math.round(members.reduce((s, m) => s + calculateInsuranceSalary(m.salaryCoefficient, m.positionCoefficient, m.regionalSalary, settings.baseSalary), 0)))}
                  </td>
                  <td style={{ ...rightCell, fontWeight: 'bold' }}>{fmt(Math.round(deptFee))}</td>
                  <td style={cellStyle}></td>
                </tr>
              </tbody>
            );
          })}
          <tr>
            <td colSpan={6} style={{ ...rightCell, fontWeight: 'bold', fontSize: '12px' }}>
              TỔNG CỘNG: {list.length} đoàn viên
            </td>
            <td style={{ ...rightCell, fontWeight: 'bold', fontSize: '12px' }}>
              {fmt(Math.round(list.reduce((s, m) => s + calculateInsuranceSalary(m.salaryCoefficient, m.positionCoefficient, m.regionalSalary, settings.baseSalary), 0)))}
            </td>
            <td style={{ ...rightCell, fontWeight: 'bold', fontSize: '12px' }}>{fmt(Math.round(totalFee))}</td>
            <td style={cellStyle}></td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '12px' }}>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <p style={{ fontWeight: 'bold' }}>NGƯỜI LẬP</p>
          <p style={{ fontStyle: 'italic', fontSize: '10px' }}>(Ký, họ tên)</p>
          <div style={{ height: '50px' }}></div>
          <p style={{ fontWeight: 'bold' }}>{orgSettings.creatorName}</p>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <p style={{ fontWeight: 'bold' }}>KẾ TOÁN</p>
          <p style={{ fontStyle: 'italic', fontSize: '10px' }}>(Ký, họ tên)</p>
          <div style={{ height: '50px' }}></div>
          <p style={{ fontWeight: 'bold' }}>{orgSettings.accountantName}</p>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <p style={{ fontWeight: 'bold' }}>LÃNH ĐẠO ĐƠN VỊ</p>
          <p style={{ fontStyle: 'italic', fontSize: '10px' }}>(Ký, họ tên)</p>
          <div style={{ height: '50px' }}></div>
          <p style={{ fontWeight: 'bold' }}>{orgSettings.leaderName}</p>
        </div>
      </div>
    </div>
  );
}
