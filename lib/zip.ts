// Lightweight, zero-dependency client-side ZIP archiver (Store / uncompressed)
// Works 100% locally in all browsers without external dependencies

function crc32(data: Uint8Array): number {
  let table = (window as unknown as { _crc32Table?: Uint32Array })._crc32Table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    (window as unknown as { _crc32Table?: Uint32Array })._crc32Table = table;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipBlob(files: { name: string; data: Uint8Array }[]): Blob {
  const fileEntries: {
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const parts: Uint8Array[] = [];
  let currentOffset = 0;

  const now = new Date();
  const time =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) &
    0xffff;
  const date =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) &
    0xffff;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const offset = currentOffset;

    // Local file header (30 bytes)
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract (2.0)
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method (0 = store)
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true); // CRC-32
    view.setUint32(18, file.data.length, true); // Compressed size
    view.setUint32(22, file.data.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length

    parts.push(header);
    parts.push(nameBytes);
    parts.push(file.data);

    currentOffset += header.length + nameBytes.length + file.data.length;
    fileEntries.push({ nameBytes, data: file.data, crc, offset });
  }

  const centralDirStart = currentOffset;

  // Central directory records
  for (const entry of fileEntries) {
    const cdHeader = new Uint8Array(46);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true); // Central directory header signature
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed to extract
    view.setUint16(8, 0, true); // General purpose bit flag
    view.setUint16(10, 0, true); // Compression method (store)
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true); // Compressed
    view.setUint32(24, entry.data.length, true); // Uncompressed
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true); // Extra field length
    view.setUint16(32, 0, true); // File comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal file attributes
    view.setUint32(38, 0, true); // External file attributes
    view.setUint32(42, entry.offset, true); // Relative offset of local header

    parts.push(cdHeader);
    parts.push(entry.nameBytes);
    currentOffset += cdHeader.length + entry.nameBytes.length;
  }

  const centralDirEnd = currentOffset;
  const centralDirSize = centralDirEnd - centralDirStart;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true); // Number of this disk
  view.setUint16(6, 0, true); // Disk where central directory starts
  view.setUint16(8, fileEntries.length, true); // Number of central directory records on this disk
  view.setUint16(10, fileEntries.length, true); // Total number of central directory records
  view.setUint32(12, centralDirSize, true); // Size of central directory
  view.setUint32(16, centralDirStart, true); // Offset of start of central directory
  view.setUint16(20, 0, true); // Comment length

  parts.push(eocd);

  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}
