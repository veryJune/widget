// 크롬 확장 폴더(extension/)를 public/stealbook-extension.zip 으로 묶습니다.
// 빌드할 때마다 자동으로 실행 → 설정 화면에서 내려받을 수 있음. (외부 패키지 없이 압축 안 한 zip)
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'extension';
const OUT = 'public/stealbook-extension.zip';
const ROOT = 'steal-book-extension/'; // 압축을 풀면 이 폴더 하나가 나옴

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(SRC);

const table = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const parts = [];
const central = [];
let offset = 0;
for (const f of files) {
  const data = readFileSync(f);
  const name = Buffer.from(ROOT + relative(SRC, f).split('\\').join('/'));
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // 파일 이름 UTF-8
  local.writeUInt16LE(0, 8); // 압축 안 함
  local.writeUInt32LE(0, 10); // 시각 (없음)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  parts.push(local, name, data);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(0, 10);
  cen.writeUInt32LE(0, 12);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(data.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += 30 + name.length + data.length;
}
const cenBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12);
end.writeUInt32LE(offset, 16);
mkdirSync('public', { recursive: true });
writeFileSync(OUT, Buffer.concat([...parts, cenBuf, end]));
console.log(`확장 묶음: ${OUT} (${files.length}개 파일)`);
