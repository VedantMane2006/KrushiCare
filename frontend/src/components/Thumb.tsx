import { useEffect, useState } from 'react';

export default function Thumb({ blob, className = '' }: { blob: Blob; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt="" className={`object-cover ${className}`} /> : <div className={`bg-gray-200 ${className}`} />;
}
