/**
 * Assemblage d'archives .ZIP directement dans le navigateur avec `fflate` (méthode STORE level 0,
 * compatible Windows/macOS/Linux/iOS/Android) et validation stricte des limites de sélection :
 * - Par défaut : 20 éléments ou 100 Mo maximum
 * - Pour les Stories Instagram : 30 éléments ou 150 Mo maximum
 */

import { zipSync, type Zippable } from 'fflate';

export const MAX_SELECTION_ITEMS = 20;
export const MAX_SELECTION_TOTAL_BYTES = 100 * 1024 * 1024; // 100 Mo
export const STORY_MAX_SELECTION_ITEMS = 30;
export const STORY_MAX_SELECTION_TOTAL_BYTES = 150 * 1024 * 1024; // 150 Mo

export interface SelectionLimitsConfig {
  maxItems?: number;
  maxBytes?: number;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

export type SelectionLimitErrorReason =
  | 'EMPTY_SELECTION'
  | 'MAX_ITEMS_EXCEEDED'
  | 'MAX_SIZE_EXCEEDED';

export interface SelectionValidationResult {
  valid: boolean;
  reason?: SelectionLimitErrorReason;
  itemCount: number;
  totalBytes: number;
}

export function parseEstimatedSizeBytes(sizeLabel?: string): number {
  if (!sizeLabel || typeof sizeLabel !== 'string') return 0;
  const match = sizeLabel
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*(B|KB|KO|MB|MO|GB|GO)$/i);
  if (!match) return 0;
  const val = parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(val) || val <= 0) return 0;
  const unit = match[2].toUpperCase();
  if (unit === 'KB' || unit === 'KO') return Math.round(val * 1024);
  if (unit === 'MB' || unit === 'MO') return Math.round(val * 1024 * 1024);
  if (unit === 'GB' || unit === 'GO') return Math.round(val * 1024 * 1024 * 1024);
  return Math.round(val);
}

export function validateSelectionLimits(
  itemCount: number,
  totalBytes = 0,
  limits?: SelectionLimitsConfig
): SelectionValidationResult {
  const maxItems = limits?.maxItems ?? MAX_SELECTION_ITEMS;
  const maxBytes = limits?.maxBytes ?? MAX_SELECTION_TOTAL_BYTES;
  if (itemCount <= 0) {
    return {
      valid: false,
      reason: 'EMPTY_SELECTION',
      itemCount: 0,
      totalBytes,
    };
  }
  if (itemCount > maxItems) {
    return {
      valid: false,
      reason: 'MAX_ITEMS_EXCEEDED',
      itemCount,
      totalBytes,
    };
  }
  if (totalBytes > maxBytes) {
    return {
      valid: false,
      reason: 'MAX_SIZE_EXCEEDED',
      itemCount,
      totalBytes,
    };
  }
  return {
    valid: true,
    itemCount,
    totalBytes,
  };
}

/**
 * Assemble une archive .ZIP standard dans le navigateur via `fflate.zipSync` (level: 0).
 */
export function buildUncompressedZipBytes(
  files: ZipEntryInput[],
  limits?: SelectionLimitsConfig
): Uint8Array {
  let totalBytes = 0;
  for (const f of files) {
    totalBytes += f.data.byteLength;
  }
  const check = validateSelectionLimits(files.length, totalBytes, limits);
  if (!check.valid && check.reason === 'MAX_ITEMS_EXCEEDED') {
    throw new Error('MAX_ITEMS_EXCEEDED');
  }
  if (!check.valid && check.reason === 'MAX_SIZE_EXCEEDED') {
    throw new Error('MAX_SIZE_EXCEEDED');
  }

  const zippable: Zippable = {};
  const usedNames = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const rawName = (files[i].name || `media_${i + 1}.jpg`).trim();
    let safeName = rawName.replace(/[\\/]+/g, '_');
    if (usedNames.has(safeName)) {
      const dotIdx = safeName.lastIndexOf('.');
      if (dotIdx > 0) {
        safeName = `${safeName.slice(0, dotIdx)}_${i + 1}${safeName.slice(dotIdx)}`;
      } else {
        safeName = `${safeName}_${i + 1}`;
      }
    }
    usedNames.add(safeName);
    zippable[safeName] = [files[i].data, { level: 0 }];
  }

  return zipSync(zippable, { level: 0 });
}

export function buildUncompressedZipArchive(
  files: ZipEntryInput[],
  limits?: SelectionLimitsConfig
): Blob {
  const zipBytes = buildUncompressedZipBytes(files, limits);
  return new Blob([zipBytes as BlobPart], {
    type: 'application/zip',
  });
}
