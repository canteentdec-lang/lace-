import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

export function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function loadImage(url: string): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid image URL');
  }

  if (url.startsWith('data:')) {
    return url;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    const timeout = setTimeout(() => {
      img.src = '';
      reject(new Error('Image load timeout'));
    }, 15000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('Could not get canvas context, resolving with original URL');
          resolve(url);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (e) {
        console.warn('Canvas conversion failed (likely CORS), resolving with original URL:', e);
        resolve(url); 
      }
    };
    
    img.onerror = () => {
      // If it fails with Anonymous, try without it (but we won't be able to use canvas)
      if (img.crossOrigin === 'Anonymous') {
        console.warn('Failed to load image with CORS, retrying without CORS...');
        img.crossOrigin = null as any;
        img.src = url;
        return;
      }
      clearTimeout(timeout);
      console.error('Failed to load image from URL:', url);
      reject(new Error('Failed to load image'));
    };
    
    img.crossOrigin = 'Anonymous';
    img.src = url;
  });
}
