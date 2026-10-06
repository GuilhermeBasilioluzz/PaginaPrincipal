'use client'

import { useEffect, useRef, useState } from 'react'

export type GalleryImage = { src: string; thumb: string; alt: string }

/**
 * Galeria da peça: fotos deslizantes (funciona sem JavaScript), miniaturas, setas do teclado e ampliação em tela cheia.
 */
export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const track = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(0)

  // acompanha qual foto está à vista enquanto a pessoa desliza
  useEffect(() => {
    const el = track.current
    if (!el || images.length < 2) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.i)) }),
      { root: el, threshold: [0.6] },
    )
    el.querySelectorAll('[data-i]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [images.length])

  const go = (i: number) => {
    const next = (i + images.length) % images.length
    const child = track.current?.querySelector<HTMLElement>(`[data-i="${next}"]`)
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    setActive(next)
  }

  const openZoom = (i: number) => { setZoom(i); dialog.current?.showModal() }
  const stepZoom = (d: number) => setZoom((z) => (z + d + images.length) % images.length)

  if (images.length === 0) return <div className="pp-photo pp-photo-empty" aria-hidden="true">{name.charAt(0)}</div>

  return (
    <div className="pp-gallery-wrap">
      <div
        ref={track} className="pp-gallery" role="group" aria-roledescription="carrossel" aria-label={`Fotos de ${name}`} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1) } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1) } }}
      >
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={img.src} data-i={i} className="pp-photo" src={img.src} alt={img.alt} width={960} height={1280}
            loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async" onClick={() => openZoom(i)} />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <p className="pp-count" aria-live="polite">{active + 1} / {images.length}</p>
          <div className="pp-thumbs" role="tablist" aria-label="Escolher foto">
            {images.map((img, i) => (
              <button key={img.thumb} type="button" role="tab" aria-selected={i === active} aria-label={`Ver foto ${i + 1}`} className={i === active ? 'on' : ''} onClick={() => go(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumb} alt="" width={64} height={85} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </>
      )}

      <dialog ref={dialog} className="pp-lightbox" aria-label={`${name} ampliada`} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close() }}>
        <button type="button" className="pp-lb-close" aria-label="Fechar" onClick={() => dialog.current?.close()}>✕</button>
        {images.length > 1 && <button type="button" className="pp-lb-nav pp-lb-prev" aria-label="Foto anterior" onClick={() => stepZoom(-1)}>‹</button>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[zoom]?.src} alt={images[zoom]?.alt} />
        {images.length > 1 && <button type="button" className="pp-lb-nav pp-lb-next" aria-label="Próxima foto" onClick={() => stepZoom(1)}>›</button>}
      </dialog>
    </div>
  )
}
