import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatError } from "@/lib/api";
import { imgUrl } from "@/lib/catalog";

export const PhotoUploader = ({ photos, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const upload = async (files) => {
    setUploading(true);
    const ids = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post("/uploads", fd);
        ids.push(data.id);
      } catch (e) {
        toast.error(formatError(e.response?.data?.detail));
      }
    }
    onChange([...photos, ...ids]);
    setUploading(false);
    inputRef.current.value = "";
  };

  return (
    <div className="flex flex-wrap gap-3" data-testid="photo-uploader">
      {photos.map((id) => (
        <div key={id} className="relative w-20 h-24 rounded-xl overflow-hidden bg-[#E6D8C5]">
          <img src={imgUrl(id)} alt="" className="w-full h-full object-cover" />
          <button type="button" data-testid="photo-remove-button" onClick={() => onChange(photos.filter((p) => p !== id))} className="absolute top-1 right-1 rounded-full bg-[#2B1810]/80 text-[#F3ECE2] p-1 hover:bg-[#2B1810]">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button type="button" data-testid="photo-add-button" onClick={() => inputRef.current.click()} disabled={uploading} className="w-20 h-24 rounded-xl border border-dashed border-[#8B7355]/60 flex flex-col items-center justify-center gap-1 text-[#8B7355] text-xs hover:bg-[#E6D8C5] transition-colors">
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        {uploading ? "Enviando" : "Adicionar"}
      </button>
      <input ref={inputRef} data-testid="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => e.target.files.length && upload([...e.target.files])} />
    </div>
  );
};
