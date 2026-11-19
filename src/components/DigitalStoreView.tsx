import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Download, FileText, Lock, Search, ShoppingBag } from 'lucide-react';
import { canDownloadMaterial, filterProducts, formatCurrencyEtb } from '../lib/storeLogic';
import { TRANSLATIONS } from '../lib/i18n';
import type {
  DigitalProduct,
  Language,
  MaterialOrder,
  ProductFilterCriteria,
} from '../types/domain';

interface DigitalStoreViewProps {
  products: DigitalProduct[];
  orders: MaterialOrder[];
  currentUserEmail: string;
  language: Language;
  onBuyProduct: (product: DigitalProduct) => void;
  onDownloadMaterial: (product: DigitalProduct, order: MaterialOrder) => void;
}

const CATEGORIES = [
  'all',
  'Payroll & HR',
  'BI Dashboards',
  'Legal & Compliance',
  'Financial Models',
  'Career & CV Kits',
];

export const DigitalStoreView: React.FC<DigitalStoreViewProps> = ({
  products,
  orders,
  currentUserEmail,
  language,
  onBuyProduct,
  onDownloadMaterial,
}) => {
  const t = TRANSLATIONS[language];
  const [criteria, setCriteria] = useState<ProductFilterCriteria>({
    query: '',
    category: 'all',
    maxPrice: 0,
  });
  const [inspectedProduct, setInspectedProduct] = useState<DigitalProduct | null>(null);

  const filteredProducts = useMemo(() => filterProducts(products, criteria), [products, criteria]);

  const getOrderForProduct = (productId: string): MaterialOrder | undefined => {
    const userOrders = orders.filter(
      (o) =>
        o.productId === productId &&
        o.buyerEmail.toLowerCase() === currentUserEmail.toLowerCase()
    );
    return (
      userOrders.find((o) => canDownloadMaterial(o)) ||
      userOrders.find((o) => o.status === 'pending_approval') ||
      userOrders[0]
    );
  };

  return (
    <div className="bg-[#F7F8FA]">
      {/* Store Header Banner */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {t.storeHeroTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.storeHeroSubtitle}</p>
          </div>

          {/* Segmented Category Filter & Search */}
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="group"
              aria-label="Store categories"
              className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1"
            >
              {CATEGORIES.map((cat) => {
                const active = criteria.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCriteria((prev) => ({ ...prev, category: cat }))}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat === 'all' ? 'All Materials' : cat}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={criteria.query}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, query: e.target.value }))}
                  placeholder="Search templates, Excel, HR..."
                  className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <select
                aria-label="Filter by max price"
                value={criteria.maxPrice}
                onChange={(e) =>
                  setCriteria((prev) => ({ ...prev, maxPrice: Number(e.target.value) }))
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none tabular-nums"
              >
                <option value={0}>Price: Any</option>
                <option value={1000}>Under 1,000 ETB</option>
                <option value={2000}>Under 2,000 ETB</option>
                <option value={3000}>Under 3,000 ETB</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              No digital materials match your filter
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Reset the category or price filter to browse all templates.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const title =
                language === 'am' && product.titleAm ? product.titleAm : product.titleEn;
              const desc =
                language === 'am' && product.descriptionAm
                  ? product.descriptionAm
                  : product.descriptionEn;
              const order = getOrderForProduct(product.id);
              const unlocked = canDownloadMaterial(order);
              const isPending = order?.status === 'pending_approval';

              return (
                <article
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  {/* 4:3 Product Thumbnail with CSS fallback */}
                  <button
                    type="button"
                    onClick={() => setInspectedProduct(product)}
                    className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left focus-visible:outline-2 focus-visible:outline-[#164081]"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 text-slate-500">
                        <FileText className="h-10 w-10" />
                        <span className="mt-2 text-xs font-semibold">{product.fileFormat}</span>
                      </div>
                    )}
                  </button>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-xs font-medium text-slate-500">
                      {product.category} · {product.fileFormat} · {product.version}
                    </div>

                    <h2 className="mt-1.5 font-display text-base font-bold text-slate-900">
                      {title}
                    </h2>

                    <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-600">
                      {desc}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div>
                        <span className="block text-[11px] text-slate-500">License Price</span>
                        <strong className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                          {formatCurrencyEtb(product.priceEtb)}
                        </strong>
                      </div>

                      {unlocked && order ? (
                        <button
                          type="button"
                          onClick={() => onDownloadMaterial(product, order)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D625C] whitespace-nowrap shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t.downloadMaterial}
                        </button>
                      ) : isPending ? (
                        <button
                          type="button"
                          onClick={() => setInspectedProduct(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 whitespace-nowrap shrink-0"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {t.awaitingApproval}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onBuyProduct(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#102E61] whitespace-nowrap shrink-0"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {t.buyMaterial}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Product Detail Inspection Modal */}
      {inspectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={inspectedProduct.titleEn}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {inspectedProduct.category} · {inspectedProduct.fileFormat} (
                  {inspectedProduct.fileSize}) · {inspectedProduct.version}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
                  {inspectedProduct.titleEn}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInspectedProduct(null)}
                className="rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <p>{inspectedProduct.descriptionEn}</p>

              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Included Downloadable Files
                </h3>
                <ul className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-700">
                  {inspectedProduct.includedFiles.map((file, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>{file}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4 text-xs text-slate-600">
                <strong className="text-slate-900">Payment &amp; Download Policy:</strong> Submit
                your Telebirr or CBE Bank transfer receipt reference at checkout. Once the TATARI
                Administrator verifies receipt of payment, the download link unlocks permanently in
                your Store and Saved &amp; Orders tabs.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrencyEtb(inspectedProduct.priceEtb)}
              </span>

              {(() => {
                const ord = getOrderForProduct(inspectedProduct.id);
                if (canDownloadMaterial(ord) && ord) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onDownloadMaterial(inspectedProduct, ord);
                        setInspectedProduct(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0D625C]"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t.downloadMaterial}
                    </button>
                  );
                }
                if (ord?.status === 'pending_approval') {
                  return (
                    <span className="text-xs font-semibold text-amber-700">
                      Receipt submitted · Awaiting Administrator verification
                    </span>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const prod = inspectedProduct;
                      setInspectedProduct(null);
                      onBuyProduct(prod);
                    }}
                    className="rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
                  >
                    {t.buyMaterial}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
