import { driveDownloadUrl } from "./googleDrive";

const encoder = new TextEncoder();

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();

  return { dosTime, dosDate };
}

function safeFilename(value, index) {
  const clean = String(value || `photo-${index + 1}.jpg`)
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();

  return clean || `photo-${index + 1}.jpg`;
}

async function fetchOriginal(photo) {
  const response = await fetch(
    driveDownloadUrl(photo.drive_file_id),
    {
      mode: "cors",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Download ${photo.filename || "foto"} gagal (${response.status}).`
    );
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export function isMobileDownloadDevice() {
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;

  return Boolean(mobileUa || (coarsePointer && window.innerWidth <= 900));
}

export async function downloadPhotosSequentially(
  photos,
  onProgress = () => {}
) {
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    onProgress({
      current: index,
      total: photos.length,
      filename: photo.filename || "Photo",
      percent: Math.round((index / photos.length) * 100),
    });

    try {
      const bytes = await fetchOriginal(photo);
      const blob = new Blob([bytes], {
        type: photo.mime_type || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeFilename(photo.filename, index);
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      console.warn("BLOB DOWNLOAD FALLBACK:", error);

      const anchor = document.createElement("a");
      anchor.href = driveDownloadUrl(photo.drive_file_id);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }

    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }

  onProgress({
    current: photos.length,
    total: photos.length,
    filename: "Selesai",
    percent: 100,
  });
}

export async function downloadPhotosAsZip(
  photos,
  zipName,
  onProgress = () => {}
) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const filename = safeFilename(photo.filename, index);

    onProgress({
      current: index,
      total: photos.length,
      filename,
      percent: Math.round((index / photos.length) * 100),
    });

    const data = await fetchOriginal(photo);
    const nameBytes = encoder.encode(filename);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0x0800);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, dosTime);
    writeU16(localView, 12, dosDate);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, data.length);
    writeU32(localView, 22, data.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0x0800);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, dosTime);
    writeU16(centralView, 14, dosDate);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, data.length);
    writeU32(centralView, 24, data.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + data.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, photos.length);
  writeU16(endView, 10, photos.length);
  writeU32(endView, 12, centralDirectory.length);
  writeU32(endView, 16, localOffset);
  writeU16(endView, 20, 0);

  const zipBytes = concat([
    ...localParts,
    centralDirectory,
    end,
  ]);

  const blob = new Blob([zipBytes], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(zipName || "PLUNO-GALLERY", 0).replace(
    /\.[^.]+$/,
    ""
  )}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);

  onProgress({
    current: photos.length,
    total: photos.length,
    filename: "ZIP selesai",
    percent: 100,
  });
}
