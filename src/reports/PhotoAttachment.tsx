import { useRef } from 'react';
interface PhotoAttachmentProps { required: boolean; file: File | null; preview: string | null; onFile: (file: File) => void; onRemove: () => void }
export const PhotoAttachment = ({ required, file, preview, onFile, onRemove }: PhotoAttachmentProps) => {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  return <div className="report-label"><span>{required ? 'Photo' : 'Photo (optional)'}</span><div className="photo-attachment">
    {preview ? <div className="report-photo-preview"><img src={preview} alt="Photo attached to this report" /><span className="photo-filename">{file?.name}</span><button type="button" onClick={onRemove}>Remove photo</button></div> : <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 10 3h4l2 2h4v15H4V5Z" /><circle cx="12" cy="12" r="4" /></svg><div className="photo-attachment-actions"><button type="button" onClick={() => camera.current?.click()}>Take photo</button><button type="button" onClick={() => picker.current?.click()}>Choose photo</button></div><p>JPG, PNG or WebP · up to 15 MB</p></>}
    <input hidden ref={camera} type="file" capture="environment" accept="image/jpeg,image/png,image/webp" aria-label="Take a location photo" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onFile(selected); event.target.value = ''; }} />
    <input hidden ref={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a location photo" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onFile(selected); event.target.value = ''; }} />
  </div></div>;
};
