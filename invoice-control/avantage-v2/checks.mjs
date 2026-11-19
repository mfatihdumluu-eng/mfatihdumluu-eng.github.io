// Pure conservative checks: all money values are nonnegative integer cents.
export function checkInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') throw new TypeError('Invoice object required');
  const issues = [];
  const isMoney = x => Number.isSafeInteger(x) && x >= 0;
  const {netCents, vatCents, grossCents, supplierId, invoiceNumber} = invoice;
  if (!String(supplierId ?? '').trim()) issues.push({code:'MISSING_SUPPLIER'});
  if (!String(invoiceNumber ?? '').trim()) issues.push({code:'MISSING_NUMBER'});
  for (const [field, val] of Object.entries({netCents, vatCents, grossCents}))
    if (!isMoney(val)) issues.push({code:'INVALID_AMOUNT', field});
  if ([netCents, vatCents, grossCents].every(isMoney) && netCents + vatCents !== grossCents)
    issues.push({code:'TOTAL_MISMATCH', differenceCents:grossCents-netCents-vatCents});
  return {status:issues.length ? 'needs_review' : 'ready_for_manual_review', issues};
}
export function findDuplicate(invoice, existing) {
  if (!invoice?.tenantId || !invoice?.supplierId || !invoice?.invoiceNumber) return false;
  const normalize = x => String(x ?? '').trim().toLowerCase();
  return existing.some(i => normalize(i.tenantId) === normalize(invoice.tenantId)
    && normalize(i.supplierId) === normalize(invoice.supplierId)
    && normalize(i.invoiceNumber) === normalize(invoice.invoiceNumber));
}
