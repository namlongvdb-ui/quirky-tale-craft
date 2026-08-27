import type { RefObject } from 'react';

type PrintOptions = {
  landscape?: boolean;
};

/**
 * Mở cửa sổ in mới với nội dung HTML của một element (giữ nguyên bố cục bảng in).
 * Trả về false nếu không lấy được nội dung hoặc trình duyệt chặn cửa sổ mới.
 */
export function printHtml(markup: string, title: string, options: PrintOptions = {}): boolean {
  if (!markup) return false;

  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) return false;

  const size = options.landscape ? 'A4 landscape' : 'A4 portrait';

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>
          @page { size: ${size}; margin: 10mm 12mm; }
          html, body { margin: 0; padding: 0; background: #fff; color: #000; }
          body { font-family: 'Times New Roman', Times, serif; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>${markup}</body>
    </html>
  `);
  printWindow.document.close();

  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
  // Fallback nếu onload đã chạy trước khi gán
  setTimeout(() => {
    try { printWindow.print(); } catch { /* ignore */ }
  }, 400);

  return true;
}

/** In nội dung của một ref element. */
export function printElementRef(
  ref: RefObject<HTMLElement>,
  title: string,
  options: PrintOptions = {}
): boolean {
  const markup = ref.current?.innerHTML;
  if (!markup) return false;
  return printHtml(markup, title, options);
}
