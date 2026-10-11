import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductCard } from './ProductCard'
import {
  CATALOG_PAGE_SIZE, SORTS, activeFilters, applyEnabledFilters, catalogHref, parseCatalogQuery, sortSizes, type CatalogQuery,
} from '@/lib/catalog'
import { AUDIENCE_LABEL } from '@/lib/catalogFilters'
import { getCatalogProducts, getCatalogStore } from '@/lib/publicCatalog'
import { publicUrl } from '@/lib/images'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { formatWhatsapp, instagramUrl, whatsappUrl } from '@/lib/storeSettings'

type Raw = Record<string, string | string[] | undefined>

export async function CatalogView({ slug, collectionSlug, searchParams }: { slug: string; collectionSlug?: string; searchParams: Raw }) {
  const catalog = await getCatalogStore(slug)
  if (!catalog) notFound()
  const { store } = catalog
  const fl = catalog.filters
  const collection = fl.collection && collectionSlug ? catalog.collections.find((c) => c.slug === collectionSlug) : undefined
  if (collectionSlug && !collection) notFound() // coleção desligada = página inexistente

  const query = applyEnabledFilters(parseCatalogQuery(searchParams), fl)
  const base = collection ? `/${store.slug}/colecao/${collection.slug}` : `/${store.slug}`
  const { items, total, failed } = await getCatalogProducts(store.slug, query, collection?.slug ?? '')
  const supabaseUrl = getSupabaseEnv()?.url ?? ''
  const pages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))

  const tops = catalog.categories.filter((c) => !c.parent_slug && c.count > 0)
  const selected = catalog.categories.find((c) => c.slug === query.category)
  const parentSlug = selected ? (selected.parent_slug ?? selected.slug) : ''
  const subs = parentSlug ? catalog.categories.filter((c) => c.parent_slug === parentSlug && c.count > 0) : []
  const filters = activeFilters(base, query, selected?.name)
  const audiences = fl.audience ? catalog.audiences.filter((a) => a.count > 0) : []
  const styles = fl.style ? catalog.styles : []
  const hasPanel = fl.color && catalog.colors.length > 0 || fl.size && catalog.sizes.length > 0 || fl.price || fl.sort || fl.stock || styles.length > 0
  const panelOpen = !!(query.style || query.color || query.size || query.min !== null || query.max !== null || query.stock || query.sort !== 'new')
  const hasFilters = filters.length > 0
  const href = (o: Partial<CatalogQuery>) => catalogHref(base, query, { page: 1, ...o })

  const wa = store.whatsapp ? whatsappUrl(store.whatsapp, `Olá! Vi o catálogo da ${store.name} e gostaria de ajuda.`) : null

  return (
    <div className="shop">
      <header className="shop-head">
        {store.banner_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="shop-banner" src={publicUrl(supabaseUrl, store.banner_path)} alt="" width={1600} height={600} fetchPriority="high" />
        )}
        <div className="shop-brand">
          {store.logo_path
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="shop-logo" src={publicUrl(supabaseUrl, store.logo_path)} alt={`Logo da ${store.name}`} width={72} height={72} />
            : <span className="shop-logo shop-logo-empty" aria-hidden="true">{store.name.charAt(0)}</span>}
          <div className="shop-title">
            {collection ? (
              <>
                <p className="small"><Link href={`/${store.slug}`} className="link">{store.name}</Link> ›</p>
                <h1>{collection.name}</h1>
              </>
            ) : (
              <>
                <h1>{store.name}</h1>
                {store.tagline && <p className="muted">{store.tagline}</p>}
              </>
            )}
          </div>
        </div>
        <div className="shop-cta">
          {wa && <a href={wa} className="btn btn-primary" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>}
          {store.instagram_handle && <a href={instagramUrl(store.instagram_handle)} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">@{store.instagram_handle}</a>}
        </div>
      </header>

      {fl.collection && catalog.collections.some((c) => c.count > 0) && (
        <nav className="chips-nav" aria-label="Coleções">
          <Link href={`/${store.slug}`} aria-current={!collection ? 'page' : undefined}>Tudo</Link>
          {catalog.collections.filter((c) => c.count > 0).map((c) => (
            <Link key={c.slug} href={`/${store.slug}/colecao/${c.slug}`} aria-current={collection?.slug === c.slug ? 'page' : undefined}>{c.name}</Link>
          ))}
        </nav>
      )}

      {catalog.total === 0 ? (
        <div className="card empty">
          <h2>Em breve, novidades por aqui.</h2>
          <p className="muted">Esta loja ainda está montando o catálogo.</p>
          {store.instagram_handle && <a href={instagramUrl(store.instagram_handle)} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">Ver no Instagram</a>}
        </div>
      ) : (
        <>
          <form className="shop-filters" action={base} method="get" role="search">
            {fl.search && (
              <div className="row search">
                <input type="search" name="q" defaultValue={query.q} placeholder="Buscar peças (vestido preto, calça jeans…)" aria-label="Buscar peças" />
                <button type="submit" className="btn btn-primary">Buscar</button>
              </div>
            )}
            {query.category && <input type="hidden" name="categoria" value={query.category} />}
            {query.audience && <input type="hidden" name="publico" value={query.audience} />}
            {hasPanel && (
            <details className="filters" open={panelOpen || undefined}>
              <summary>Filtrar e ordenar</summary>
              <div className="grid-2">
                {styles.length > 0 && (
                  <label className="field"><span className="field-label">Estilo</span>
                    <select name="estilo" defaultValue={query.style}><option value="">Todos</option>{styles.map((s) => <option key={s.name}>{s.name}</option>)}</select></label>
                )}
                {fl.color && catalog.colors.length > 0 && (
                  <label className="field"><span className="field-label">Cor</span>
                    <select name="cor" defaultValue={query.color}><option value="">Todas</option>{catalog.colors.map((c) => <option key={c}>{c}</option>)}</select></label>
                )}
                {fl.size && catalog.sizes.length > 0 && (
                  <label className="field"><span className="field-label">Tamanho</span>
                    <select name="tamanho" defaultValue={query.size}><option value="">Todos</option>{sortSizes(catalog.sizes).map((s) => <option key={s}>{s}</option>)}</select></label>
                )}
                {fl.price && (
                  <>
                    <label className="field"><span className="field-label">Preço mínimo (R$)</span>
                      <input name="min" inputMode="decimal" defaultValue={query.min ?? ''} placeholder={catalog.price_min !== null ? String(Math.floor(catalog.price_min)) : ''} /></label>
                    <label className="field"><span className="field-label">Preço máximo (R$)</span>
                      <input name="max" inputMode="decimal" defaultValue={query.max ?? ''} placeholder={catalog.price_max !== null ? String(Math.ceil(catalog.price_max)) : ''} /></label>
                  </>
                )}
                {fl.sort && (
                  <label className="field"><span className="field-label">Ordenar por</span>
                    <select name="ordem" defaultValue={query.sort}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                )}
                {fl.stock && <label className="check"><input type="checkbox" name="estoque" value="1" defaultChecked={query.stock} /> Mostrar só o que tem em estoque</label>}
              </div>
              <div className="row"><button type="submit" className="btn btn-ghost">Aplicar</button></div>
            </details>
            )}
          </form>

          {audiences.length > 1 && (
            <nav className="chips-nav" aria-label="Público">
              <Link href={href({ audience: '' })} aria-current={!query.audience ? 'page' : undefined}>Todos</Link>
              {audiences.map((a) => <Link key={a.value} href={href({ audience: a.value })} aria-current={query.audience === a.value ? 'page' : undefined}>{AUDIENCE_LABEL[a.value]}</Link>)}
            </nav>
          )}
          {fl.category && tops.length > 0 && (
            <nav className="chips-nav" aria-label="Categorias">
              <Link href={href({ category: '' })} aria-current={!query.category ? 'page' : undefined}>Todas as categorias</Link>
              {tops.map((c) => <Link key={c.slug} href={href({ category: c.slug })} aria-current={query.category === c.slug ? 'page' : undefined}>{c.name}</Link>)}
            </nav>
          )}
          {fl.category && subs.length > 0 && (
            <nav className="chips-nav chips-sub" aria-label="Subcategorias">
              {subs.map((c) => <Link key={c.slug} href={href({ category: c.slug })} aria-current={query.category === c.slug ? 'page' : undefined}>{c.name}</Link>)}
            </nav>
          )}

          {hasFilters && (
            <div className="row active-filters" aria-label="Filtros ativos">
              {filters.map((f) => <Link key={f.label} href={f.href} className="badge" aria-label={`Remover filtro ${f.label}`}>{f.label} ✕</Link>)}
              <Link href={base} className="link small">Limpar tudo</Link>
            </div>
          )}

          {failed && <p className="notice notice-error" role="alert">Não foi possível carregar as peças agora. Tente novamente em instantes.</p>}
          {!failed && items.length === 0 && (
            <div className="card empty">
              <h2>Nenhuma peça encontrada.</h2>
              <p className="muted">Tente outra busca ou remova alguns filtros.</p>
              <Link href={base} className="btn btn-ghost">Ver todas as peças</Link>
            </div>
          )}

          {items.length > 0 && (
            <>
              <p className="muted small" aria-live="polite">{total} {total === 1 ? 'peça' : 'peças'}{collection?.automatic ? ` · ${collection.name} se atualiza sozinha` : ''}</p>
              <ul className="shop-grid">
                {items.map((p, i) => <ProductCard key={p.id} product={p} storeSlug={store.slug} supabaseUrl={supabaseUrl} priority={i < 4} />)}
              </ul>
            </>
          )}

          {pages > 1 && (
            <nav className="row spread" aria-label="Páginas">
              {query.page > 1 ? <Link className="btn btn-ghost" href={catalogHref(base, query, { page: query.page - 1 })} rel="prev">← Anterior</Link> : <span />}
              <span className="muted small">Página {query.page} de {pages}</span>
              {query.page < pages ? <Link className="btn btn-ghost" href={catalogHref(base, query, { page: query.page + 1 })} rel="next">Próxima →</Link> : <span />}
            </nav>
          )}
        </>
      )}

      <footer className="shop-foot">
        {store.description && <p>{store.description}</p>}
        {store.address && <p className="muted small">📍 {store.address}</p>}
        {store.opening_hours && <p className="muted small">🕒 {store.opening_hours}</p>}
        {store.whatsapp && <p className="muted small">WhatsApp {formatWhatsapp(store.whatsapp)}</p>}
        <p className="muted small">Catálogo por <strong>Hyperion Systems</strong></p>
      </footer>
    </div>
  )
}
