// Dunia Digital — penyalin entry deterministik (news-image-20261123-v2)
//
// Tugas file ini cuma satu: menyalin entry.png yang sudah jadi di repo ini
// ke $MAKEFUN_OUTPUT_DIR/entry.png, lalu memastikan salinannya sah dan
// identik byte demi byte. Tanpa network, tanpa angka acak, tanpa waktu —
// dua kali jalan harus menghasilkan byte yang sama persis.

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tanda tangan PNG (8 byte pertama setiap file PNG yang valid).
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const WANT_WIDTH = 1024;
const WANT_HEIGHT = 1024;
const MAX_BYTES = 1024 * 1024; // 1 MiB

const REPO_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(REPO_DIR, "entry.png");

function fail(reason: string): never {
  console.error(`dunia-digital: gagal: ${reason}`);
  process.exit(1);
}

function targetDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.trim() !== "") {
    return resolve(fromEnv);
  }
  return resolve(REPO_DIR, "out");
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function checkMagic(buf: Buffer): void {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    fail("entry.png bukan file PNG (tanda tangan tidak cocok)");
  }
}

function readPngSize(buf: Buffer): { width: number; height: number } {
  // Chunk IHDR: 8 byte tanda tangan + 4 panjang + 4 "IHDR",
  // lalu 4 byte lebar dan 4 byte tinggi (big-endian).
  if (buf.length < 33 || buf.toString("ascii", 12, 16) !== "IHDR") {
    fail("entry.png tidak punya chunk IHDR yang valid");
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function loadSource(): Buffer {
  let info;
  try {
    info = statSync(SOURCE_PATH);
  } catch {
    fail(`tidak menemukan ${SOURCE_PATH}`);
  }
  if (info.size > MAX_BYTES) {
    fail(`entry.png ${info.size} byte, melebihi batas ${MAX_BYTES} byte`);
  }
  const bytes = readFileSync(SOURCE_PATH);
  checkMagic(bytes);
  const size = readPngSize(bytes);
  if (size.width !== WANT_WIDTH || size.height !== WANT_HEIGHT) {
    fail(
      `dimensi entry.png ${size.width}x${size.height}, ` +
        `harus ${WANT_WIDTH}x${WANT_HEIGHT}`,
    );
  }
  return bytes;
}

function publish(bytes: Buffer): string {
  const dir = targetDir();
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, "entry.png");
  writeFileSync(dest, bytes);
  return dest;
}

// Memeriksa ulang salinan yang sudah tertulis di disk: baca lagi dari
// file tujuan, lalu cocokkan tanda tangan, dimensi, ukuran, dan hash
// dengan sumber. Verifikasi dua lapis: sekali di memori (di run), sekali
// dari disk (di sini), supaya kerusakan saat tulis pasti ketahuan.
function verifyOnDisk(dest: string, expected: Buffer): void {
  let onDisk: Buffer;
  try {
    onDisk = readFileSync(dest);
  } catch {
    fail(`tidak bisa membaca kembali ${dest}`);
  }
  checkMagic(onDisk);
  const size = readPngSize(onDisk);
  if (size.width !== WANT_WIDTH || size.height !== WANT_HEIGHT) {
    fail(
      `salinan di disk berdimensi ${size.width}x${size.height}, ` +
        `harus ${WANT_WIDTH}x${WANT_HEIGHT}`,
    );
  }
  if (onDisk.length !== expected.length) {
    fail(
      `salinan di disk ${onDisk.length} byte, sumber ${expected.length} byte`,
    );
  }
  if (sha256Hex(onDisk) !== sha256Hex(expected)) {
    fail("hash salinan di disk berbeda dari hash sumber");
  }
  const diskInfo = statSync(dest);
  if (diskInfo.size !== expected.length) {
    fail("ukuran file di disk tidak cocok dengan sumber");
  }
}

function run(): void {
  const bytes = loadSource();
  const dest = publish(bytes);
  const written = readFileSync(dest);
  if (!written.equals(bytes)) {
    fail("salinan di output tidak identik dengan sumber");
  }
  verifyOnDisk(dest, bytes);
  const size = readPngSize(bytes);
  console.log(
    `dunia-digital: OK ${size.width}x${size.height} ${bytes.length} byte -> ${dest}`,
  );
  console.log(`dunia-digital: sha256 ${sha256Hex(bytes)}`);
}

run();
