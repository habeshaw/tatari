import { useEffect, useState, type FormEvent } from 'react';
import { FileText, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '../api';
import { DICT, type Lang } from '../i18n';
import type { AuthUser, DigitalProduct } from '../types';

interface DigitalStoreViewProps {
  user: AuthUser | null;
  lang: Lang;
  onRequireAuth: () => void;
  onOrderSubmitted: () => void;
}

export function DigitalStoreView({
  user,
  lang,
  onRequireAuth,
  onOrderSubmitted,
}: DigitalStoreViewProps) {
  const t = DICT[lang];
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<DigitalProduct | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Telebirr');
  const [paymentRef, setPaymentRef] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    apiFetch<{ products: DigitalProduct[] }>('/api/store/products')
      .then((res) => setProducts(res.products))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openPurchaseModal(product: DigitalProduct) {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSelectedProduct(product);
    setPaymentRef('');
    setReceiptNote('');
    setError(null);
  }

  async function handleCheckoutSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/store/orders', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProduct.id,
          payment_method: paymentMethod,
          payment_ref: paymentRef,
          receipt_note: receiptNote,
        }),
      });
      setSuccessMsg(res.message);
      setSelectedProduct(null);
      onOrderSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit payment receipt');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t.storeTitle}</h1>
          <p className="text-sm sm:text-base text-slate-600">{t.storeSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#164081]" />
          <span>Telebirr &amp; CBE Receipt Verification Enabled</span>
        </div>
      </section>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4 text-sm text-emerald-900">
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <article
              key={product.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                {imgErrors[product.id] ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-100 text-slate-500">
                    <FileText className="w-8 h-8 mb-2 text-[#164081]" />
                    <span className="text-xs font-semibold text-slate-700">{product.title}</span>
                  </div>
                ) : (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, [product.id]: true }))}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">
                    <span>{product.category}</span>
                    <span aria-hidden="true" className="mx-1.5">
                      ·
                    </span>
                    <span>{product.format_info}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-snug">{product.title}</h2>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {product.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {product.price_etb.toLocaleString()} ETB
                  </span>
                  <button
                    type="button"
                    onClick={() => openPurchaseModal(product)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg transition-colors whitespace-nowrap"
                  >
                    Buy Toolkit
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Payment Receipt Checkout Modal */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 id="checkout-modal-title" className="text-lg font-bold text-slate-900">
                Submit Payment Receipt
              </h2>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close checkout dialog"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="text-sm font-bold text-slate-900">{selectedProduct.title}</p>
                <p className="text-xs text-slate-600 tabular-nums">
                  Amount Due: <span className="font-semibold text-slate-900">{selectedProduct.price_etb} ETB</span> ·{' '}
                  {selectedProduct.format_info}
                </p>
                <p className="text-xs text-slate-500 pt-1">
                  Transfer to Telebirr Merchant <span className="font-mono font-semibold">0911-824410</span> or CBE{' '}
                  <span className="font-mono font-semibold">1000482910384</span>, then enter your receipt ID below.
                </p>
              </div>

              {error && (
                <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="pay-method" className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Channel
                </label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Telebirr">Telebirr</option>
                  <option value="CBE Bank Transfer">CBE Bank Transfer</option>
                  <option value="CBE Birr">CBE Birr</option>
                </select>
              </div>

              <div>
                <label htmlFor="pay-ref" className="block text-xs font-medium text-slate-700 mb-1">
                  Transaction / Receipt Reference Number
                </label>
                <input
                  id="pay-ref"
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. TB-83920145"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="pay-note" className="block text-xs font-medium text-slate-700 mb-1">
                  Receipt Details / Sender Phone (Optional)
                </label>
                <input
                  id="pay-note"
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Paid from +251 911..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] disabled:opacity-60 rounded-lg"
                >
                  {submitting ? 'Submitting...' : 'Submit Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
