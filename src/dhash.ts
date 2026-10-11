// Perceptual "difference hash" (dHash) for the photo-reuse check.
// Shrinks an image to 9x8 grey squares and records, for each row, whether
// each square is brighter than its right-hand neighbour: 64 bits.
// Two photos of the same picture (even resized or re-saved) land within a
// few bits of each other; different pictures differ by ~25+ bits.
// Pure JavaScript so it runs on the Anbaric container without native code.
import jpeg from "jpeg-js";

/** dHash of raw RGB(A) pixels. `channels` is 3 (RGB) or 4 (RGBA). */
export function dhashRaw(data: Uint8Array, width: number, height: number, channels: number): string {
    const W = 9, H = 8;
    const grey = new Float64Array(W * H);
    // Box-average every source pixel into its 9x8 cell
    const sums = new Float64Array(W * H);
    const counts = new Float64Array(W * H);
    for (let y = 0; y < height; y++) {
        const cy = Math.min(H - 1, Math.floor((y * H) / height));
        for (let x = 0; x < width; x++) {
            const cx = Math.min(W - 1, Math.floor((x * W) / width));
            const i = (y * width + x) * channels;
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sums[cy * W + cx] += lum;
            counts[cy * W + cx] += 1;
        }
    }
    for (let k = 0; k < W * H; k++) grey[k] = counts[k] ? sums[k] / counts[k] : 0;
    let bits = "";
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W - 1; x++) bits += grey[y * W + x] > grey[y * W + x + 1] ? "1" : "0";
    // 64 bits -> 16 hex characters
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
}

/** dHash of a JPEG file's bytes (the browser always uploads JPEG). */
export function dhashJpeg(bytes: Uint8Array): string {
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
    return dhashRaw(img.data, img.width, img.height, 4);
}

/** Number of differing bits between two 16-hex-character hashes. */
export function hamming(a: string, b: string): number {
    let d = 0;
    for (let i = 0; i < 16; i++) {
        let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
        while (x) { d += x & 1; x >>= 1; }
    }
    return d;
}
