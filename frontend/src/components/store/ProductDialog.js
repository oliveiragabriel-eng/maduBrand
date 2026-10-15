import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { brl } from "@/lib/api";
import { categoryLabel, effectivePrice, imgUrl, pixPrice, WHATSAPP_NUMBER } from "@/lib/catalog";
import { ProductPhoto } from "@/components/store/ProductCard";

const buildMessage = (p, v, qty) =>
  [
    "Olá! Vi no site da Madu Brand e tenho interesse nesta peça:",
    "",
    `*${p.name}* (${categoryLabel(p.category)})`,
    `Cor: ${v.color}`,
    `Tamanho: ${v.size}`,
    `Quantidade: ${qty}`,
    `Valor: ${brl(effectivePrice(v))}${
      qty > 1 ? ` cada · Total: ${brl(effectivePrice(v) * qty)}` : ""
    }`,
    v.promotional_price != null ? `Preço original: ${brl(v.price)}` : null,
    p.description ? `Descrição: ${p.description}` : null,
    "",
    "Podemos fechar a compra?",
  ]
    .filter((l) => l !== null)
    .join("\n");

export const ProductDialog = ({ product, onClose }) => {
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    if (product) {
      setColor(product.variants[0].color);
      setSize(product.variants[0].size);
      setQty(1);
      setPhoto(0);
    }
  }, [product]);

  const variants = useMemo(() => product?.variants || [], [product]);
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizesForColor = variants
    .filter((v) => v.color === color)
    .map((v) => v.size);
  const variant = variants.find((v) => v.color === color && v.size === size);

  const photos = (() => {
    const own = variants
      .filter((v) => v.color === color)
      .flatMap((v) => v.photos || []);

    return own.length ? own : product?.photos || [];
  })();

  const pickColor = (c) => {
    setColor(c);
    setPhoto(0);
    setQty(1);

    if (!variants.some((v) => v.color === c && v.size === size)) {
      setSize(variants.find((v) => v.color === c).size);
    }
  };

  const buy = () => {
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        buildMessage(product, variant, qty)
      )}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-[#F3ECE2] border-[#2B1810]/10 max-w-4xl p-0 overflow-hidden max-h-[92vh] overflow-y-auto"
        data-testid="product-dialog"
      >
        {product && (
          <div className="grid md:grid-cols-2">
            <Gallery
              photos={photos}
              active={photo}
              onPick={setPhoto}
              name={product.name}
            />

            <div className="p-6 sm:p-8 flex flex-col">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B7355]">
                {categoryLabel(product.category)}
              </p>

              <DialogTitle
                className="font-serif text-4xl text-[#2B1810] mt-2 leading-tight"
                data-testid="product-dialog-name"
              >
                {product.name}
              </DialogTitle>

              <div className="mt-3" data-testid="product-dialog-price">
                {variant?.promotional_price != null && <p className="text-sm text-[#8B7355] line-through">{brl(variant.price)}</p>}
                <p className="text-2xl font-semibold text-[#2B1810]">{variant ? brl(effectivePrice(variant)) : "—"}</p>
                {variant && <p className="text-xs text-[#7A3E24] mt-1">-5% no Pix, dinheiro ou débito: {brl(pixPrice(effectivePrice(variant)))}</p>}
              </div>

              <DialogDescription
                className="text-sm text-[#6B5A4E] mt-4 whitespace-pre-line"
                data-testid="product-dialog-description"
              >
                {product.description || "Peça exclusiva Madu Brand."}
              </DialogDescription>

              <Options
                label="Cor"
                values={colors}
                value={color}
                onPick={pickColor}
                testid="product-color"
              />

              <Options
                label="Tamanho"
                values={sizesForColor}
                value={size}
                onPick={(s) => {
                  setSize(s);
                  setQty(1);
                }}
                testid="product-size"
              />

              <QtyPicker
                qty={qty}
                max={variant?.quantity || 1}
                onChange={setQty}
              />

              <button
                data-testid="product-buy-button"
                disabled={!variant}
                onClick={buy}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#2B1810] text-[#F3ECE2] py-4 font-medium hover:bg-[#5A3A26] transition-colors disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                Comprar pelo WhatsApp
              </button>

              <p className="text-xs text-[#8B7355] mt-3 text-center">
                Você será direcionada para finalizar a compra no WhatsApp.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Gallery = ({ photos, active, onPick, name }) => {
  const hasMultiplePhotos = photos.length > 1;

  useEffect(() => {
    if (!hasMultiplePhotos) return;
    [photos[(active + 1) % photos.length], photos[(active - 1 + photos.length) % photos.length]]
      .filter(Boolean)
      .forEach((id) => {
        const image = new Image();
        image.src = imgUrl(id);
      });
  }, [active, hasMultiplePhotos, photos]);

  const previousPhoto = () => {
    onPick((active - 1 + photos.length) % photos.length);
  };

  const nextPhoto = () => {
    onPick((active + 1) % photos.length);
  };

  return (
    <div className="bg-[#E6D8C5]">
      <div className="relative">
        <ProductPhoto
          id={photos[active]}
          alt={name}
          loading="eager"
          className="w-full aspect-[3/4] md:h-full md:aspect-auto md:min-h-[520px]"
        />

        {hasMultiplePhotos && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={previousPhoto}
              data-testid="product-previous-photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-[#F3ECE2]/90 text-[#2B1810] shadow-md hover:bg-[#F3ECE2] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              aria-label="Próxima foto"
              onClick={nextPhoto}
              data-testid="product-next-photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-[#F3ECE2]/90 text-[#2B1810] shadow-md hover:bg-[#F3ECE2] transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {hasMultiplePhotos && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {photos.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Ver foto ${i + 1}`}
              data-testid={`product-thumb-${i}`}
              className={`w-14 h-16 rounded-lg overflow-hidden flex-shrink-0 ring-2 transition-shadow ${
                i === active ? "ring-[#2B1810]" : "ring-transparent"
              }`}
            >
              <ProductPhoto id={id} alt="" className="w-full h-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Options = ({ label, values, value, onPick, testid }) => (
  <div className="mt-6">
    <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355] mb-2">
      {label}:{" "}
      <span className="text-[#2B1810] normal-case tracking-normal">
        {value}
      </span>
    </p>

    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          data-testid={`${testid}-${v}`}
          onClick={() => onPick(v)}
          className={`min-w-[3rem] rounded-full px-4 py-2 text-sm border transition-colors ${
            v === value
              ? "bg-[#2B1810] text-[#F3ECE2] border-[#2B1810]"
              : "border-[#2B1810]/20 text-[#2B1810] hover:border-[#2B1810]"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  </div>
);

const QtyPicker = ({ qty, max, onChange }) => (
  <div className="mt-6">
    <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355] mb-2">
      Quantidade{" "}
      <span className="normal-case tracking-normal text-[#6B5A4E]">
        ({max} disponíve{max > 1 ? "is" : "l"})
      </span>
    </p>

    <div className="inline-flex items-center gap-4 rounded-full border border-[#2B1810]/20 px-2 py-1">
      <button
        type="button"
        data-testid="product-qty-minus"
        onClick={() => onChange(Math.max(1, qty - 1))}
        className="p-2 rounded-full hover:bg-[#E6D8C5]"
      >
        <Minus className="w-4 h-4" />
      </button>

      <span data-testid="product-qty-value" className="w-6 text-center font-medium">
        {qty}
      </span>

      <button
        type="button"
        data-testid="product-qty-plus"
        onClick={() => onChange(Math.min(max, qty + 1))}
        className="p-2 rounded-full hover:bg-[#E6D8C5]"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  </div>
);
