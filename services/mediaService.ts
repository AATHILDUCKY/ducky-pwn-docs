type MediaResult = { url: string; name: string } | null;

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

const pickFileFallback = (accept: string): Promise<MediaResult> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve({
        url: URL.createObjectURL(file),
        name: file.name,
      });
    };
    input.click();
  });

export const selectMediaFile = async (mediaType: 'image' | 'video'): Promise<MediaResult> => {
  const api = electronAPI();
  if (api?.selectMedia) {
    return api.selectMedia(mediaType);
  }
  const accept = mediaType === 'video' ? 'video/*' : 'image/*';
  return pickFileFallback(accept);
};
