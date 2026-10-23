// Descarga una tabla como archivo de Excel (.xlsx). La primera fila es el encabezado y va
// en negrita; widths son los anchos de columna en caracteres. La librería se carga recién
// al exportar, para no sumar su peso a la carga inicial del sitio.
export async function downloadExcel(filename: string, header: string[], rows: string[][], widths: number[]): Promise<void> {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const sheetData = [
        header.map((value) => ({ value, fontWeight: "bold" as const })),
        ...rows.map((r) => r.map((value) => ({ value, wrap: true }))),
    ];
    await writeExcelFile(sheetData, { columns: widths.map((width) => ({ width })), stickyRowsCount: 1 }).toFile(filename);
}
