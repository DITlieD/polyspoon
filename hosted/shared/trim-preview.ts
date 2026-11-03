export function trimPreview(image: HTMLImageElement, fill?: readonly [number, number, number]) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 8 || height < 8) return;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const context = source.getContext('2d', {willReadFrequently: true});
  if (!context) return;
  let pixels: Uint8ClampedArray;
  try {
    context.drawImage(image, 0, 0);
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return;
  }
  const at = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0, pixels[index + 3] ?? 0] as const;
  };
  const gap = (left: readonly [number, number, number, number], right: readonly [number, number, number, number]) => Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2]) + Math.abs(left[3] - right[3]);
  const background = at(0, 0);
  const corners = [background, at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  if (corners.some(corner => gap(corner, background) > 24)) return;
  const content = (x: number, y: number) => {
    const pixel = at(x, y);
    if (background[3] < 16) return pixel[3] > 16;
    return gap(pixel, background) > 36;
  };
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const step = 1;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (!content(x, y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return;
  const pad = 12;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  if (cropWidth < 16 || cropHeight < 16) return;
  if (cropWidth > width - 2 && cropHeight > height - 2) return;
  const cropped = document.createElement('canvas');
  cropped.width = cropWidth;
  cropped.height = cropHeight;
  const output = cropped.getContext('2d');
  if (!output) return;
  output.drawImage(source, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  if (fill && background[3] >= 16) {
    const frame = output.getImageData(0, 0, cropWidth, cropHeight), data = frame.data, seen = new Uint8Array(cropWidth * cropHeight), queue: number[] = [];
    const near = (index: number) => Math.abs(data[index * 4]! - background[0]) + Math.abs(data[index * 4 + 1]! - background[1]) + Math.abs(data[index * 4 + 2]! - background[2]) <= 30;
    const push = (index: number) => { if (!seen[index] && near(index)) { seen[index] = 1; queue.push(index); } };
    for (let x = 0; x < cropWidth; x++) { push(x); push((cropHeight - 1) * cropWidth + x); }
    for (let y = 0; y < cropHeight; y++) { push(y * cropWidth); push(y * cropWidth + cropWidth - 1); }
    while (queue.length) {
      const index = queue.pop()!, x = index % cropWidth;
      data[index * 4] = fill[0]; data[index * 4 + 1] = fill[1]; data[index * 4 + 2] = fill[2];
      if (x > 0) push(index - 1);
      if (x < cropWidth - 1) push(index + 1);
      if (index >= cropWidth) push(index - cropWidth);
      if (index < cropWidth * (cropHeight - 1)) push(index + cropWidth);
    }
    output.putImageData(frame, 0, 0);
  }
  image.src = cropped.toDataURL('image/png');
}
