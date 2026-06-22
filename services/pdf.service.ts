// EduManage — PDF service
//
// Uses `expo-print` to render HTML → PDF in-app. Each helper returns
// `{ pdfUrl, error }` where `pdfUrl` is a `file://` URL the caller can
// pass to `expo-sharing` or display in a `WebView`.

import * as Print from 'expo-print';
import { ServiceResult } from '@/lib/types';

interface PrintResult {
  pdfUrl: string;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(amount: number, currency = 'KES'): string {
  return `${currency} ${Number(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const BASE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #0B1426; margin: 0; padding: 32px; }
  h1 { font-size: 24px; margin: 0 0 4px 0; }
  h2 { font-size: 18px; margin: 0 0 4px 0; }
  h3 { font-size: 14px; margin: 24px 0 8px 0; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0B1426; padding-bottom: 16px; margin-bottom: 24px; }
  .school-name { font-size: 20px; font-weight: 700; }
  .meta { text-align: right; color: #475569; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
  th { background: #F1F5F9; font-weight: 600; }
  .total-row td { font-weight: 700; border-top: 2px solid #0B1426; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 11px; display: flex; justify-content: space-between; }
  .signature { margin-top: 64px; }
  .signature-line { width: 200px; border-top: 1px solid #475569; padding-top: 4px; font-size: 12px; color: #475569; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #DCFCE7; color: #166534; font-size: 11px; font-weight: 600; }
  .amount { font-family: 'SF Mono', Menlo, monospace; }
`;

async function renderPdf(html: string): Promise<ServiceResult<PrintResult>> {
  try {
    const result = await Print.printToFileAsync({ html });
    // expo-print ≥ 12 returns { uri }, older versions return { uri } too — handle both
    const uri = (result as { uri?: string }).uri ?? (result as unknown as string);
    if (!uri) {
      return { data: null, error: 'PDF generation produced no output' };
    }
    return { data: { pdfUrl: uri }, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface ReceiptPDFOpts {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  receiptNumber: string;
  paymentNumber: string;
  studentName: string;
  admissionNumber: string;
  className?: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paidAt: string;
  receivedBy?: string;
  remarks?: string;
  invoiceNumber?: string;
}

export async function generateReceiptPDF(opts: ReceiptPDFOpts): Promise<ServiceResult<PrintResult>> {
  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(opts.receiptNumber)}</title><style>${BASE_STYLE}</style></head>
    <body>
      <div class="header">
        <div>
          <div class="school-name">${escapeHtml(opts.schoolName)}</div>
          ${opts.schoolAddress ? `<div style="color:#475569;font-size:12px;">${escapeHtml(opts.schoolAddress)}</div>` : ''}
          ${opts.schoolPhone ? `<div style="color:#475569;font-size:12px;">Tel: ${escapeHtml(opts.schoolPhone)}</div>` : ''}
        </div>
        <div class="meta">
          <div><strong>RECEIPT</strong></div>
          <div># ${escapeHtml(opts.receiptNumber)}</div>
          <div>${formatDate(opts.paidAt)}</div>
        </div>
      </div>

      <table>
        <tr><th>Student</th><td>${escapeHtml(opts.studentName)}</td></tr>
        <tr><th>Admission No.</th><td>${escapeHtml(opts.admissionNumber)}</td></tr>
        ${opts.className ? `<tr><th>Class</th><td>${escapeHtml(opts.className)}</td></tr>` : ''}
        ${opts.invoiceNumber ? `<tr><th>Invoice</th><td>${escapeHtml(opts.invoiceNumber)}</td></tr>` : ''}
        <tr><th>Payment Ref.</th><td>${escapeHtml(opts.paymentNumber)}</td></tr>
        <tr><th>Method</th><td>${escapeHtml(opts.paymentMethod)}</td></tr>
        <tr><th>Date Paid</th><td>${formatDate(opts.paidAt)}</td></tr>
      </table>

      <h3>Amount Received</h3>
      <table>
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="amount" style="text-align:right;">${escapeHtml(formatCurrency(opts.amount, opts.currency))}</td>
        </tr>
      </table>

      ${opts.remarks ? `<p style="font-size:12px;color:#475569;"><strong>Remarks:</strong> ${escapeHtml(opts.remarks)}</p>` : ''}

      <div class="signature">
        <div class="signature-line">Received by: ${escapeHtml(opts.receivedBy ?? '_______________')}</div>
      </div>

      <div class="footer">
        <div>This is a computer-generated receipt.</div>
        <div>Generated ${formatDate(new Date().toISOString())}</div>
      </div>
    </body></html>
  `;
  return renderPdf(html);
}

// ─── Report card ─────────────────────────────────────────────────────────────

export interface ReportCardSubjectRow {
  subject: string;
  score: number;
  maxScore: number;
  grade: string;
  remarks?: string;
}

export interface ReportCardPDFOpts {
  schoolName: string;
  schoolAddress?: string;
  schoolMotto?: string;
  studentName: string;
  admissionNumber: string;
  className?: string;
  streamName?: string;
  termName: string;
  academicYear: string;
  subjects: ReportCardSubjectRow[];
  totalScore: number;
  maxTotal: number;
  averageScore: number;
  grade: string;
  position: number;
  totalStudents?: number;
  classTeacher?: string;
  classTeacherRemarks?: string;
  principalRemarks?: string;
}

export async function generateReportCardPDF(opts: ReportCardPDFOpts): Promise<ServiceResult<PrintResult>> {
  const rowsHtml = opts.subjects
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.subject)}</td>
        <td style="text-align:right;" class="amount">${Number(s.score).toFixed(2)}</td>
        <td style="text-align:right;" class="amount">${Number(s.maxScore).toFixed(2)}</td>
        <td style="text-align:center;"><span class="badge">${escapeHtml(s.grade)}</span></td>
        <td>${escapeHtml(s.remarks ?? '')}</td>
      </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Report Card — ${escapeHtml(opts.studentName)}</title><style>${BASE_STYLE}</style></head>
    <body>
      <div class="header">
        <div>
          <div class="school-name">${escapeHtml(opts.schoolName)}</div>
          ${opts.schoolAddress ? `<div style="color:#475569;font-size:12px;">${escapeHtml(opts.schoolAddress)}</div>` : ''}
          ${opts.schoolMotto ? `<div style="color:#64748B;font-size:11px;font-style:italic;">${escapeHtml(opts.schoolMotto)}</div>` : ''}
        </div>
        <div class="meta">
          <div><strong>PROGRESS REPORT</strong></div>
          <div>${escapeHtml(opts.termName)} — ${escapeHtml(opts.academicYear)}</div>
        </div>
      </div>

      <table>
        <tr><th>Student</th><td>${escapeHtml(opts.studentName)}</td></tr>
        <tr><th>Admission No.</th><td>${escapeHtml(opts.admissionNumber)}</td></tr>
        ${opts.className ? `<tr><th>Class</th><td>${escapeHtml(opts.className)}${opts.streamName ? ' — ' + escapeHtml(opts.streamName) : ''}</td></tr>` : ''}
      </table>

      <h3>Subject Performance</h3>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th style="text-align:right;">Score</th>
            <th style="text-align:right;">Max</th>
            <th style="text-align:center;">Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td>TOTAL</td>
            <td style="text-align:right;" class="amount">${Number(opts.totalScore).toFixed(2)}</td>
            <td style="text-align:right;" class="amount">${Number(opts.maxTotal).toFixed(2)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>

      <h3>Summary</h3>
      <table>
        <tr><th>Average Score</th><td class="amount">${Number(opts.averageScore).toFixed(2)}%</td></tr>
        <tr><th>Overall Grade</th><td><span class="badge">${escapeHtml(opts.grade)}</span></td></tr>
        <tr><th>Position</th><td>${opts.position}${opts.totalStudents ? ` out of ${opts.totalStudents}` : ''}</td></tr>
      </table>

      ${opts.classTeacherRemarks ? `<h3>Class Teacher's Remarks</h3><p style="font-size:13px;line-height:1.5;">${escapeHtml(opts.classTeacherRemarks)}</p>` : ''}
      ${opts.principalRemarks ? `<h3>Principal's Remarks</h3><p style="font-size:13px;line-height:1.5;">${escapeHtml(opts.principalRemarks)}</p>` : ''}

      <div class="signature" style="display:flex;justify-content:space-between;">
        <div class="signature-line">Class Teacher: ${escapeHtml(opts.classTeacher ?? '_______________')}</div>
        <div class="signature-line">Principal: _______________</div>
      </div>

      <div class="footer">
        <div>This report is computer-generated and valid without a signature.</div>
        <div>Generated ${formatDate(new Date().toISOString())}</div>
      </div>
    </body></html>
  `;
  return renderPdf(html);
}

// ─── Financial report ────────────────────────────────────────────────────────

export interface FinancialReportPDFOpts {
  schoolName: string;
  periodStart: string;
  periodEnd: string;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalScholarships: number;
  totalFines: number;
  collectedCount: number;
  outstandingCount: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  currency?: string;
  generatedBy?: string;
}

export async function generateFinancialReportPDF(opts: FinancialReportPDFOpts): Promise<ServiceResult<PrintResult>> {
  const statusRows = Object.entries(opts.byStatus)
    .map(
      ([status, count]) =>
        `<tr><td>${escapeHtml(status)}</td><td style="text-align:right;">${count}</td></tr>`,
    )
    .join('');
  const methodRows = Object.entries(opts.byMethod)
    .map(
      ([method, amount]) =>
        `<tr><td>${escapeHtml(method)}</td><td style="text-align:right;" class="amount">${escapeHtml(formatCurrency(amount, opts.currency))}</td></tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Financial Report — ${escapeHtml(opts.schoolName)}</title><style>${BASE_STYLE}</style></head>
    <body>
      <div class="header">
        <div>
          <div class="school-name">${escapeHtml(opts.schoolName)}</div>
          <div style="color:#475569;font-size:12px;">Financial Report</div>
        </div>
        <div class="meta">
          <div><strong>PERIOD</strong></div>
          <div>${formatDate(opts.periodStart)} — ${formatDate(opts.periodEnd)}</div>
        </div>
      </div>

      <h3>Summary</h3>
      <table>
        <tr class="total-row"><td>Total Billed</td><td style="text-align:right;" class="amount">${escapeHtml(formatCurrency(opts.totalBilled, opts.currency))}</td></tr>
        <tr><td>Total Collected</td><td style="text-align:right;" class="amount">${escapeHtml(formatCurrency(opts.totalCollected, opts.currency))}</td></tr>
        <tr><td>Total Outstanding</td><td style="text-align:right;color:#DC2626;" class="amount">${escapeHtml(formatCurrency(opts.totalOutstanding, opts.currency))}</td></tr>
        <tr><td>Total Scholarships</td><td style="text-align:right;" class="amount">${escapeHtml(formatCurrency(opts.totalScholarships, opts.currency))}</td></tr>
        <tr><td>Total Fines</td><td style="text-align:right;" class="amount">${escapeHtml(formatCurrency(opts.totalFines, opts.currency))}</td></tr>
      </table>

      <h3>Invoices by Status</h3>
      <table>
        <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
        <tbody>${statusRows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
      </table>

      <h3>Payments by Method</h3>
      <table>
        <thead><tr><th>Method</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${methodRows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
      </table>

      <h3>Counts</h3>
      <table>
        <tr><td>Invoices with payments</td><td style="text-align:right;">${opts.collectedCount}</td></tr>
        <tr><td>Invoices outstanding</td><td style="text-align:right;">${opts.outstandingCount}</td></tr>
      </table>

      <div class="footer">
        <div>Prepared by: ${escapeHtml(opts.generatedBy ?? 'Bursar')}</div>
        <div>Generated ${formatDate(new Date().toISOString())}</div>
      </div>
    </body></html>
  `;
  return renderPdf(html);
}
