import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Chuẩn hóa văn bản tiếng Việt để so sánh: bỏ dấu, viết thường, bỏ khoảng trắng thừa */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tìm tên đoàn viên xuất hiện trong một đoạn văn bản */
export function findStaffInText(text: string, staffNames: string[]): string | null {
  const normalizedContent = normalizeText(text);
  if (!normalizedContent) return null;

  // Sắp xếp tên dài trước để tránh khớp nhầm tên ngắn nằm trong tên dài
  const sortedNames = [...staffNames].sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    const normalizedName = normalizeText(name);
    if (normalizedName && normalizedName.length > 3 && normalizedContent.includes(normalizedName)) {
      return name;
    }
  }
  return null;
}

/** Danh sách từ khóa lý do chi tiêu cụ thể để đối soát (ưu tiên các lý do đặc thù) */
const SPECIFIC_REASON_KEYWORDS = [
  'om', 'dau', 'nam vien', 'dieu tri', 'phau thuat', 
  'thai san', 'sinh con', 
  'ket hon', 'dam cuoi', 
  'hiu', 'hy', 'tu than phu mau', 'phung duong',
  'con ket hon',
  'le tet', 'nghi mat', 'boi duong',
  'phong trao', 'dai hoi', 'khen thuong', 'hoc tap'
];

/** So sánh hai nội dung lý do xem có cùng mục đích không */
export function isSimilarReason(reason1: string, reason2: string): boolean {
  const r1 = normalizeText(reason1);
  const r2 = normalizeText(reason2);
  
  if (!r1 || !r2) return false;

  // 1. Kiểm tra xem có chung từ khóa lý do cụ thể nào không
  for (const kw of SPECIFIC_REASON_KEYWORDS) {
    const has1 = r1.includes(kw);
    const has2 = r2.includes(kw);
    
    // Nếu cả hai đều có chung một từ khóa cụ thể (VD: cùng là 'om') -> Giống nhau
    if (has1 && has2) return true;
    
    // Nếu một cái có từ khóa cụ thể, cái kia không có -> Khác nhau (VD: 'om' vs 'phong trao')
    if (has1 !== has2) return false;
  }

  // 2. Nếu không dính từ khóa cụ thể nào, kiểm tra từ khóa chung "tham hoi"
  const isTh1 = r1.includes('tham hoi');
  const isTh2 = r2.includes('tham hoi');
  if (isTh1 && isTh2) return true; // Cả hai đều là thăm hỏi chung chung
  if (isTh1 !== isTh2) return false;

  // 3. Cuối cùng mới kiểm tra độ tương đồng văn bản (chứa nhau)
  return r1.includes(r2) || r2.includes(r1);
}


