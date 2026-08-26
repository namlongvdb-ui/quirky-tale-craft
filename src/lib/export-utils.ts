import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getTransactions, getOpeningBalance, getOrgSettings } from '@/lib/finance-store';
import { StaffMember, StaffSettings } from '@/types/finance';
import { calculateInsuranceSalary, calculateUnionFee } from '@/lib/staff-store';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}

const typeLabels: Record<string, string> = {
  thu: 'Phiếu Thu',
  chi: 'Phiếu Chi',
  'tham-hoi': 'Thăm Hỏi',
  'de-nghi': 'Đề Nghị TT',
};

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function applyTableStyle(sheet: ExcelJS.Worksheet, headerRow: number, lastRow: number, lastCol: number) {
  for (let r = headerRow; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER_STYLE;
      if (r === headerRow) {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
  }
}

export async function exportCashBookExcel() {
  const settings = getOrgSettings();
  const txs = getTransactions()
    .filter(tx => tx.type === 'thu' || tx.type === 'chi')
    .sort((a, b) => a.date.localeCompare(b.date));
  const opening = getOpeningBalance();
  let balance = opening;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sổ Quỹ');

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = settings.orgName + ' - ' + settings.orgSubName;
  sheet.getCell('A1').font = { bold: true, size: 12 };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = 'SỔ QUỸ TIỀN MẶT';
  sheet.getCell('A2').font = { bold: true, size: 14 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  const headerRow = 4;
  const headers = ['Ngày CT', 'Số CT', 'Nội dung', 'Thu', 'Chi', 'Tồn'];
  sheet.getRow(headerRow).values = headers;
  
  sheet.getRow(5).values = ['', '', 'Số dư đầu kỳ', '', '', opening];
  sheet.getRow(5).getCell(6).numFmt = '#,##0';

  let currentRow = 6;
  txs.forEach(tx => {
    const thu = tx.type === 'thu' ? tx.amount : 0;
    const chi = tx.type === 'chi' ? tx.amount : 0;
    balance = balance + thu - chi;
    const row = sheet.getRow(currentRow++);
    row.values = [formatDate(tx.date), tx.voucherNo, tx.description, thu || '', chi || '', balance];
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
  });

  const totalThu = txs.filter(t => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
  const totalChi = txs.filter(t => t.type === 'chi').reduce((s, t) => s + t.amount, 0);
  
  const totalRow = sheet.getRow(currentRow++);
  totalRow.values = ['', '', 'Tổng phát sinh', totalThu, totalChi, ''];
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(5).numFmt = '#,##0';

  const finalRow = sheet.getRow(currentRow++);
  finalRow.values = ['', '', 'Số dư cuối kỳ', '', '', opening + totalThu - totalChi];
  finalRow.font = { bold: true };
  finalRow.getCell(6).numFmt = '#,##0';

  applyTableStyle(sheet, headerRow, currentRow - 1, 6);

  sheet.columns = [
    { width: 15 }, { width: 12 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `SoQuy_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportDetailLedgerExcel() {
  const settings = getOrgSettings();
  const txs = getTransactions()
    .filter(tx => tx.type === 'thu' || tx.type === 'chi')
    .sort((a, b) => a.date.localeCompare(b.date));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sổ Chi Tiết');

  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').value = settings.orgName + ' - ' + settings.orgSubName;
  sheet.getCell('A1').font = { bold: true, size: 12 };

  sheet.mergeCells('A2:K2');
  sheet.getCell('A2').value = 'SỔ CHI TIẾT TÀI KHOẢN';
  sheet.getCell('A2').font = { bold: true, size: 14 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  const headerRow = 4;
  const headers = ['Ngày CT', 'Số CT', 'Loại', 'Số tiền', 'Nội dung', 'Thu', 'Chi', 'TK', 'Họ tên', 'Đơn vị', 'Lãnh đạo'];
  sheet.getRow(headerRow).values = headers;

  let currentRow = 5;
  txs.forEach(tx => {
    const row = sheet.getRow(currentRow++);
    row.values = [
      formatDate(tx.date),
      tx.voucherNo,
      typeLabels[tx.type] || tx.type,
      tx.amount,
      tx.description,
      tx.type === 'thu' ? tx.amount : '',
      tx.type === 'chi' ? tx.amount : '',
      tx.accountCode,
      tx.personName,
      tx.department,
      tx.approver,
    ];
    row.getCell(4).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).numFmt = '#,##0';
  });

  applyTableStyle(sheet, headerRow, currentRow - 1, 11);

  sheet.columns = [
    { width: 14 }, { width: 10 }, { width: 12 }, { width: 16 }, { width: 40 }, { width: 16 }, { width: 16 }, { width: 8 }, { width: 20 }, { width: 25 }, { width: 20 }
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `SoChiTiet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportFullReportExcel() {
  const settings = getOrgSettings();
  const txs = getTransactions().sort((a, b) => a.date.localeCompare(b.date));
  const opening = getOpeningBalance();
  const workbook = new ExcelJS.Workbook();

  const totalThu = txs.filter(t => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
  const totalChi = txs.filter(t => t.type === 'chi').reduce((s, t) => s + t.amount, 0);
  const totalTH = txs.filter(t => t.type === 'tham-hoi').reduce((s, t) => s + t.amount, 0);
  const totalDN = txs.filter(t => t.type === 'de-nghi').reduce((s, t) => s + t.amount, 0);

  // Summary Sheet
  const ws1 = workbook.addWorksheet('Tổng quan');
  ws1.addRow([settings.orgName]).font = { bold: true };
  ws1.addRow([settings.orgSubName]).font = { bold: true };
  ws1.addRow(['BÁO CÁO TÀI CHÍNH TỔNG HỢP']).font = { bold: true, size: 14 };
  ws1.addRow([`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
  ws1.addRow([]);
  
  const summaryHeader = 6;
  ws1.getRow(summaryHeader).values = ['Chỉ tiêu', 'Số tiền (VNĐ)'];
  ws1.addRow(['Số dư đầu kỳ', opening]);
  ws1.addRow(['Tổng thu', totalThu]);
  ws1.addRow(['Tổng chi', totalChi]);
  ws1.addRow(['Tổng thăm hỏi', totalTH]);
  ws1.addRow(['Tổng đề nghị thanh toán', totalDN]);
  ws1.addRow(['Số dư cuối kỳ', opening + totalThu - totalChi]);
  ws1.addRow([]);
  ws1.addRow(['Tổng số chứng từ', txs.length]);
  ws1.addRow(['Phiếu thu', txs.filter(t => t.type === 'thu').length]);
  ws1.addRow(['Phiếu chi', txs.filter(t => t.type === 'chi').length]);
  ws1.addRow(['Phiếu thăm hỏi', txs.filter(t => t.type === 'tham-hoi').length]);
  ws1.addRow(['Đề nghị thanh toán', txs.filter(t => t.type === 'de-nghi').length]);

  applyTableStyle(ws1, summaryHeader, summaryHeader + 7, 2);
  ws1.getColumn(1).width = 35;
  ws1.getColumn(2).width = 20;
  ws1.getColumn(2).numFmt = '#,##0';

  // Sổ Quỹ Sheet
  const ws2 = workbook.addWorksheet('Sổ Quỹ');
  const cashHeader = 1;
  ws2.getRow(cashHeader).values = ['Ngày CT', 'Số CT', 'Nội dung', 'Thu', 'Chi', 'Tồn'];
  ws2.addRow(['', '', 'Số dư đầu kỳ', '', '', opening]);
  let balance = opening;
  txs.forEach(tx => {
    if (tx.type === 'thu' || tx.type === 'chi') {
      const thu = tx.type === 'thu' ? tx.amount : 0;
      const chi = tx.type === 'chi' ? tx.amount : 0;
      balance = balance + thu - chi;
      ws2.addRow([formatDate(tx.date), tx.voucherNo, tx.description, thu || '', chi || '', balance]);
    }
  });
  ws2.addRow(['', '', 'Số dư cuối kỳ', '', '', opening + totalThu - totalChi]).font = { bold: true };
  applyTableStyle(ws2, cashHeader, ws2.rowCount, 6);
  ws2.columns = [{ width: 14 }, { width: 10 }, { width: 50 }, { width: 16 }, { width: 16 }, { width: 16 }];
  ws2.getColumn(4).numFmt = '#,##0';
  ws2.getColumn(5).numFmt = '#,##0';
  ws2.getColumn(6).numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `BaoCaoTaiChinh_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportStaffListExcel(list: StaffMember[], staffSettings: StaffSettings, orgSettings: any) {
  const settings = orgSettings;
  const workbook = new ExcelJS.Workbook();

  const fmt = (n: number) => Math.round(n);

  // Group by department and sort
  const grouped: Record<string, typeof list> = {};
  for (const s of list) {
    const dept = s.department || 'Chưa phân tổ';
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(s);
  }
  
  const getSortName = (n: string) => {
    const p = n.trim().split(' ');
    return p[p.length - 1].toLowerCase();
  };

  for (const dept of Object.keys(grouped)) {
    grouped[dept].sort((a, b) => {
      const nameA = getSortName(a.fullName);
      const nameB = getSortName(b.fullName);
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'vi');
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  }

  // Summary sheet first
  const wsSummary = workbook.addWorksheet('Tổng hợp');
  wsSummary.addRow([settings.orgName + ' - ' + settings.orgSubName]).font = { bold: true };
  wsSummary.addRow(['TỔNG HỢP DANH SÁCH ĐOÀN VIÊN']).font = { bold: true, size: 14 };
  wsSummary.addRow([]);
  
  const summaryHeader = 4;
  wsSummary.getRow(summaryHeader).values = ['Tổ công đoàn', 'Số đoàn viên', 'Tổng đoàn phí CĐ/tháng'];
  let grandTotal = 0;
  for (const [dept, members] of Object.entries(grouped)) {
    const deptFee = members.reduce((sum, s) => {
      const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, staffSettings.baseSalary);
      return sum + calculateUnionFee(lbh, staffSettings.baseSalary);
    }, 0);
    grandTotal += deptFee;
    wsSummary.addRow([dept, members.length, fmt(deptFee)]);
  }
  const grandTotalRow = wsSummary.addRow(['TỔNG CỘNG', list.length, fmt(grandTotal)]);
  grandTotalRow.font = { bold: true };

  applyTableStyle(wsSummary, summaryHeader, wsSummary.rowCount, 3);
  wsSummary.getColumn(1).width = 45;
  wsSummary.getColumn(2).width = 16;
  wsSummary.getColumn(3).width = 25;
  wsSummary.getColumn(3).numFmt = '#,##0';

  // Sheet for each union group
  for (const [dept, members] of Object.entries(grouped)) {
    const sheetName = dept.length > 31 ? dept.substring(0, 28) + '...' : dept;
    const ws = workbook.addWorksheet(sheetName);
    
    ws.addRow([settings.orgName + ' - ' + settings.orgSubName]).font = { bold: true };
    ws.addRow([`DANH SÁCH ĐOÀN VIÊN - ${dept.toUpperCase()}`]).font = { bold: true, size: 13 };
    ws.addRow([`Lương cơ sở: ${staffSettings.baseSalary.toLocaleString('vi-VN')} đ`]);
    ws.addRow([]);

    const headerRowIdx = 5;
    ws.getRow(headerRowIdx).values = ['STT', 'Họ và tên', 'Chức vụ', 'Ngày sinh', 'GT', 'HS lương', 'HS CV', 'Lương vùng', 'Lương BH', 'Đoàn phí CĐ'];

    let totalFee = 0;
    members.forEach((s, i) => {
      const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, staffSettings.baseSalary);
      const fee = calculateUnionFee(lbh, staffSettings.baseSalary);
      totalFee += fee;
      const row = ws.addRow([
        i + 1,
        s.fullName,
        s.position,
        s.birthDate ? new Date(s.birthDate).toLocaleDateString('vi-VN') : '',
        s.gender === 'nam' ? 'Nam' : 'Nữ',
        s.salaryCoefficient,
        s.positionCoefficient,
        fmt(s.regionalSalary),
        fmt(lbh),
        fmt(fee),
      ]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
    });

    const totalRow = ws.addRow(['', '', '', '', '', '', '', 'TỔNG CỘNG:', '', fmt(totalFee)]);
    totalRow.font = { bold: true };

    applyTableStyle(ws, headerRowIdx, ws.rowCount, 10);
    ws.columns = [
      { width: 6 }, { width: 25 }, { width: 18 }, { width: 14 }, { width: 8 },
      { width: 12 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 },
    ];
    
    [8, 9, 10].forEach(col => ws.getColumn(col).numFmt = '#,##0');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `DanhSachDoanVien_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
