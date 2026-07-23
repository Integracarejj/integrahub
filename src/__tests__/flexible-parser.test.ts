import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';

/* ── Helper: build a File-like object from 2D data ─────────── */
function buildFile(name: string, data: (string | number)[][], sheetName?: string): File {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return new File([blob], name, { lastModified: Date.now() });
}

function buildMultiSheetFile(name: string, sheets: { name: string; data: (string | number)[][] }[]): File {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(s.data);
        XLSX.utils.book_append_sheet(wb, ws, s.name);
    }
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return new File([blob], name, { lastModified: Date.now() });
}

import { parseUploadedXLSX } from '../services/portalMockData';

/* ═══════════════════════════════════════════════════════════════
   FORMAT A — Standard two-column with sequence number
   ═══════════════════════════════════════════════════════════════ */
describe('Format A: Standard two-column with sequence number', () => {
    it('parses # / Request Title format', async () => {
        const file = buildFile('standard.xlsx', [
            ['#', 'Request Title'],
            [1, 'Audited financial statements for last 3 fiscal years'],
            [2, 'Current rent roll with unit mix and lease terms'],
            [3, 'Certificate of occupancy for all buildings'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(3);
        expect(result.rows[0]['Request Title']).toContain('Audited financial');
        expect(result.rows[0]['Source Item Number']).toBe('1');
        expect(result.headers).toEqual(expect.arrayContaining(['Source Item Number', 'Request Title']));
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT B — Single-column request list (no sequence)
   ═══════════════════════════════════════════════════════════════ */
describe('Format B: Single-column request list', () => {
    it('parses single column with header', async () => {
        const file = buildFile('single-col.xlsx', [
            ['Due Diligence Request'],
            ['Provide copies of all insurance policies'],
            ['Submit environmental Phase I reports'],
            ['Furnish ADA compliance documentation'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(3);
        expect(result.rows[0]['Request Title']).toContain('insurance policies');
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT C — Three columns: category + sequence + request
   ═══════════════════════════════════════════════════════════════ */
describe('Format C: Three columns with category', () => {
    it('maps Category, #, and Description columns', async () => {
        const file = buildFile('three-col.xlsx', [
            ['Category', '#', 'Due diligence request'],
            ['Financial', 1, 'Provide audited financial statements for last 3 years'],
            ['Financial', 2, 'Submit year-to-date operating statement'],
            ['Legal', 3, 'Furnish copies of all executed leases'],
            ['Legal', 4, 'Provide litigation history summary'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(4);
        expect(result.rows[0]['Category']).toBe('Financial');
        expect(result.rows[0]['Source Item Number']).toBe('1');
        expect(result.rows[2]['Category']).toBe('Legal');
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT D — Header on row 4 (metadata above)
   ═══════════════════════════════════════════════════════════════ */
describe('Format D: Header row not on row 0', () => {
    it('detects header row 4 with blank/title rows above', async () => {
        const file = buildFile('header-row4.xlsx', [
            ['Project Keystone Due Diligence'],
            ['Prepared: January 2024'],
            [],
            ['#', 'Request Title', 'Notes'],
            [1, 'Environmental site assessment Phase I', 'Required by lender'],
            [2, 'Title commitment and exception documents', ''],
            [3, 'Property tax bills for last 3 years', ''],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(3);
        expect(result.rows[0]['Request Title']).toContain('Environmental');
        expect(result.rows[0]['Notes']).toBe('Required by lender');
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT E — No header row (pure data, content-based inference)
   ═══════════════════════════════════════════════════════════════ */
describe('Format E: No sequence column, two-column description-only', () => {
    it('parses a file where the only data columns are request text and category', async () => {
        const file = buildFile('desc-only.xlsx', [
            ['Due Diligence Request', 'Category'],
            ['Provide audited financial statements for the last 3 fiscal years', 'Financial'],
            ['Submit current rent roll with unit mix and lease terms', 'Financial'],
            ['Furnish certificate of occupancy for all buildings', 'Legal'],
            ['Environmental Phase I assessment report', 'Environmental'],
            ['ADA compliance inspection report', 'Compliance'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(5);
        expect(result.rows[0]['Request Title']).toContain('financial statements');
        expect(result.rows[0]['Category']).toBe('Financial');
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT F — Multi-worksheet, selects best sheet
   ═══════════════════════════════════════════════════════════════ */
describe('Format F: Multi-worksheet selection', () => {
    it('picks the sheet with request content over summary/cover sheets', async () => {
        const file = buildMultiSheetFile('multi-sheet.xlsx', [
            {
                name: 'Cover Page',
                data: [
                    ['Project Name', 'Acme Portfolio'],
                    ['Date', '2024-01-15'],
                    ['Prepared By', 'Atlas Capital Partners'],
                ],
            },
            {
                name: 'DD Requests',
                data: [
                    ['#', 'Request Title'],
                    [1, 'Audited financial statements for last 3 fiscal years'],
                    [2, 'Current rent roll with unit mix and lease terms'],
                    [3, 'Certificate of occupancy for all buildings'],
                    [4, 'Environmental site assessment Phase I report'],
                ],
            },
            {
                name: 'Instructions',
                data: [
                    ['Step', 'Description'],
                    ['1', 'Complete all required fields'],
                    ['2', 'Submit to broker for review'],
                ],
            },
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.sheetName).toBe('DD Requests');
        expect(result.count).toBe(4);
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT G — Blank rows interspersed
   ═══════════════════════════════════════════════════════════════ */
describe('Format G: Blank rows interspersed', () => {
    it('skips blank rows and keeps request count correct', async () => {
        const file = buildFile('blank-rows.xlsx', [
            ['#', 'Request Title'],
            [1, 'Audited financial statements for last 3 fiscal years'],
            [],
            [2, 'Current rent roll with unit mix and lease terms'],
            [],
            [],
            [3, 'Certificate of occupancy for all buildings'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(3);
        expect(result.diagnostics.skippedCount).toBeGreaterThanOrEqual(3);
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT H — Section headers between request groups
   ═══════════════════════════════════════════════════════════════ */
describe('Format H: Section headers between request groups', () => {
    it('skips section header rows and inherits category', async () => {
        const file = buildFile('section-headers.xlsx', [
            ['#', 'Request Title'],
            ['SECTION A', ''],
            [1, 'Audited financial statements for last 3 fiscal years'],
            [2, 'Current rent roll with unit mix and lease terms'],
            ['Section B', ''],
            [3, 'Certificate of occupancy for all buildings'],
            [4, 'Environmental site assessment Phase I report'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(4);
        expect(result.rows[0]['Request Title']).toContain('financial');
        expect(result.rows[2]['Request Title']).toContain('Certificate');
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT I — Ambiguous column names (content-only classification)
   ═══════════════════════════════════════════════════════════════ */
describe('Format I: Ambiguous column names', () => {
    it('classifies columns by content when headers are vague', async () => {
        const file = buildFile('ambiguous.xlsx', [
            ['Col A', 'Col B', 'Col C'],
            ['1', 'Audited financial statements for last 3 fiscal years', 'Financial'],
            ['2', 'Current rent roll with unit mix and lease terms', 'Financial'],
            ['3', 'Certificate of occupancy for all buildings', 'Legal'],
            ['4', 'Environmental site assessment Phase I report', 'Environmental'],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(4);
        const requestCol = result.headers.find(h => h === 'Request Title');
        expect(requestCol).toBeDefined();
        expect(result.rows[0]['Request Title']).toContain('Audited');
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT J — Unsupported file type (not .xlsx)
   ═══════════════════════════════════════════════════════════════ */
describe('Format J: Plain text file disguised as XLSX', () => {
    it('returns 0 rows and does not crash on non-XLSX content', async () => {
        const textBlob = new Blob(['this is not an xlsx file at all, just plain text'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const file = new File([textBlob], 'readme.xlsx', { lastModified: Date.now() });
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(0);
        expect(result.rows.length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   FORMAT K — Original Project Keystone format (the broken one)
   ═══════════════════════════════════════════════════════════════ */
describe('Format K: Project Keystone format (# / Due diligence request)', () => {
    it('handles the exact format that previously failed', async () => {
        const file = buildFile('keystone.xlsx', [
            ['#', 'Due diligence request', 'Category', 'Notes'],
            ['1', 'Provide audited financial statements for the last 3 fiscal years', 'Financial', 'Required by lender'],
            ['2', 'Submit current year-to-date operating statement', 'Financial', ''],
            ['3', 'Furnish executed copies of all leases with amendments', 'Legal', ''],
            ['4', 'Provide copies of all service contracts and vendor agreements', 'Legal', ''],
            ['5', 'Environmental Phase I ESA report', 'Environmental', 'Phase I required'],
            ['6', 'ADA compliance inspection report', 'Compliance', ''],
        ]);
        const result = await parseUploadedXLSX(file);
        expect(result.count).toBe(6);
        expect(result.rows[0]['Request Title']).toContain('financial statements');
        expect(result.rows[0]['Source Item Number']).toBe('1');
        expect(result.rows[0]['Category']).toBe('Financial');
        expect(result.rows[0]['Notes']).toBe('Required by lender');
        expect(result.rows[2]['Request Title']).toContain('leases');
        expect(result.rows[4]['Request Title']).toContain('Phase I');
    });
});

/* ═══════════════════════════════════════════════════════════════
   Diagnostics — parseDiagnostics fields are populated
   ═══════════════════════════════════════════════════════════════ */
describe('Diagnostics: parseDiagnostics fields are populated', () => {
    it('returns populated diagnostics object', async () => {
        const file = buildFile('diag.xlsx', [
            ['#', 'Request Title'],
            [1, 'Audited financial statements for last 3 fiscal years'],
            [2, 'Current rent roll with unit mix and lease terms'],
        ]);
        const result = await parseUploadedXLSX(file);
        const d = result.diagnostics;
        expect(d.fileName).toBe('diag.xlsx');
        expect(d.fileSize).toBeGreaterThan(0);
        expect(d.sheetNames).toContain('Sheet1');
        expect(d.selectedSheet).toBe('Sheet1');
        expect(d.totalPhysicalRows).toBeGreaterThanOrEqual(3);
        expect(d.acceptedCount).toBe(2);
        expect(typeof d.normalizedHeaders).toBe('object');
        expect(Array.isArray(d.firstTenAccepted)).toBe(true);
        expect(d.firstTenAccepted.length).toBe(2);
    });
});
